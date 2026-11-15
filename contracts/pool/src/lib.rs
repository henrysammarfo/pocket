//! Pocket private pool (testnet).
//!
//! A fixed size NEAR note pool in the tornado-core design, ported to NEAR with code from the hideyour.cash
//! mixer (see docs/SOURCES.md):
//!
//! * `deposit(commitment)` takes exactly `denomination` yoctoNEAR and appends the commitment
//!   (MiMCSponge(secret, nullifier), made on the phone) to a depth 20 MiMC Merkle tree kept on chain.
//! * `withdraw(...)` pays one note to `recipient` when a Groth16 proof shows that the caller knows the secret
//!   behind some leaf of a recent root, without saying which leaf. The nullifier hash is recorded so a note
//!   pays once. The recipient, the relayer and the fee are public inputs of the proof, so a relayer cannot
//!   change where the money goes.
//!
//! There is no owner and no admin method. The verifying key is fixed at init.
//!
//! Spending limits: Pocket wallets (contracts/wallet) put money in only through `send_private`, which checks the
//! wallet's per send and 24 hour caps before the deposit. See docs/POLICY.md for what that does and does not cover.

use near_sdk::json_types::U128;
use near_sdk::store::{LookupMap, LookupSet, Vector};
use near_sdk::{env, log, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise, PromiseError};

mod groth16;
mod mimc;
#[allow(clippy::all)]
mod mimc_constants;

pub use groth16::{Proof, VerifyingKey};

uint::construct_uint! {
    pub struct U256(4);
}

pub const LEVELS: u32 = 20;
pub const ROOT_HISTORY: usize = 30;
const GAS_PAYOUT_CB: Gas = Gas::from_tgas(10);

#[derive(BorshStorageKey)]
#[near]
enum Key {
    Subtrees,
    Leaves,
    Nullifiers,
    Commitments,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Pool {
    denomination: u128,
    vk: VerifyingKey,
    /// Hashes of empty subtrees, one per level (zeros[0] is the empty leaf).
    zeros: Vec<[u8; 32]>,
    subtrees: LookupMap<u32, [u8; 32]>,
    roots: Vec<[u8; 32]>,
    root_index: u32,
    leaves: Vector<[u8; 32]>,
    nullifiers: LookupSet<[u8; 32]>,
    commitments: LookupSet<[u8; 32]>,
}

fn be(v: &U256) -> [u8; 32] {
    let mut b = [0u8; 32];
    v.to_big_endian(&mut b);
    b
}

fn from_be(b: &[u8; 32]) -> U256 {
    U256::from_big_endian(b)
}

fn field(s: &str, what: &str) -> U256 {
    let v = groth16::dec(s).unwrap_or_else(|| env::panic_str(&format!("Bad {}.", what)));
    require!(v < U256::from_dec_str(groth16::R).unwrap(), format!("{} is not in the field.", what));
    v
}

/// An account id as a field element: the first 31 bytes of its sha256, big endian. The app computes the same.
pub fn account_field(a: &AccountId) -> U256 {
    let h = env::sha256(a.as_bytes());
    U256::from_big_endian(&h[..31])
}

/// The empty leaf: keccak256("tornado") mod r, as in tornado-core's MerkleTreeWithHistory.
pub const ZERO_LEAF: &str = "21663839004416932945382355908790599225266501822907911457504978515578255421292";

#[near(serializers = [json])]
pub struct PoolInfo {
    pub denomination: U128,
    pub levels: u32,
    pub leaves: u32,
    pub root: String,
}

#[near]
impl Pool {
    #[init]
    pub fn new(denomination: U128, vk: VerifyingKey) -> Self {
        require!(denomination.0 > 0, "Denomination must be above zero.");
        require!(vk.ic.len() == 7, "The verifying key must have six public inputs.");
        let mut zeros = Vec::with_capacity(LEVELS as usize + 1);
        let mut cur = U256::from_dec_str(ZERO_LEAF).unwrap();
        for _ in 0..=LEVELS {
            zeros.push(be(&cur));
            cur = mimc::sponge(&[cur, cur]);
        }
        let empty_root = zeros[LEVELS as usize];
        Self {
            denomination: denomination.0,
            vk,
            zeros,
            subtrees: LookupMap::new(Key::Subtrees),
            roots: vec![empty_root],
            root_index: 0,
            leaves: Vector::new(Key::Leaves),
            nullifiers: LookupSet::new(Key::Nullifiers),
            commitments: LookupSet::new(Key::Commitments),
        }
    }

    /// Put one note in. Attach exactly the denomination.
    #[payable]
    pub fn deposit(&mut self, commitment: String) -> u32 {
        require!(env::attached_deposit().as_yoctonear() == self.denomination, "Attach exactly one note's amount.");
        let c = field(&commitment, "commitment");
        let key = be(&c);
        require!(!self.commitments.contains(&key), "That note was already deposited.");
        let index = self.leaves.len();
        require!(index < (1u32 << LEVELS), "The pool is full.");
        let mut cur = c;
        let mut i = index;
        for level in 0..LEVELS {
            let (left, right) = if i % 2 == 0 {
                self.subtrees.insert(level, be(&cur));
                (cur, from_be(&self.zeros[level as usize]))
            } else {
                (from_be(self.subtrees.get(&level).unwrap()), cur)
            };
            cur = mimc::sponge(&[left, right]);
            i /= 2;
        }
        self.root_index = (self.root_index + 1) % ROOT_HISTORY as u32;
        let ri = self.root_index as usize;
        if ri < self.roots.len() {
            self.roots[ri] = be(&cur);
        } else {
            self.roots.push(be(&cur));
        }
        self.commitments.insert(key);
        self.leaves.push(key);
        log!("EVENT_JSON:{{\"standard\":\"pocket_pool\",\"version\":\"1\",\"event\":\"deposit\",\"data\":{{\"index\":{},\"commitment\":\"{}\"}}}}", index, commitment);
        index
    }

    /// Pay one note to `recipient`. Anyone may submit this (a relayer, so the receiver needs no gas).
    #[allow(clippy::too_many_arguments)]
    pub fn withdraw(
        &mut self,
        proof: Proof,
        root: String,
        nullifier_hash: String,
        recipient: AccountId,
        relayer: Option<AccountId>,
        fee: U128,
    ) -> Promise {
        let r = field(&root, "root");
        let n = field(&nullifier_hash, "nullifier hash");
        require!(self.roots.contains(&be(&r)), "Unknown or too old root.");
        let nk = be(&n);
        require!(!self.nullifiers.contains(&nk), "That note was already spent.");
        require!(fee.0 < self.denomination, "Fee is too high.");
        let relayer_field = match &relayer {
            Some(a) => account_field(a),
            None => {
                require!(fee.0 == 0, "A fee needs a relayer.");
                U256::zero()
            }
        };
        let inputs = [r, n, account_field(&recipient), relayer_field, U256::from(fee.0), U256::zero()];
        require!(groth16::verify(&self.vk, &inputs, &proof), "Invalid proof.");
        self.nullifiers.insert(nk);
        log!("EVENT_JSON:{{\"standard\":\"pocket_pool\",\"version\":\"1\",\"event\":\"withdraw\",\"data\":{{\"nullifier_hash\":\"{}\"}}}}", nullifier_hash);
        let mut p = Promise::new(recipient.clone()).transfer(NearToken::from_yoctonear(self.denomination - fee.0));
        if let (Some(rel), true) = (relayer, fee.0 > 0) {
            p = p.then(Promise::new(rel).transfer(NearToken::from_yoctonear(fee.0)));
        }
        p.then(Self::ext(env::current_account_id()).with_static_gas(GAS_PAYOUT_CB).on_payout(nullifier_hash))
    }

    /// If the payout failed (for example the recipient account does not exist), the note becomes spendable again.
    #[private]
    pub fn on_payout(&mut self, nullifier_hash: String, #[callback_result] r: Result<(), PromiseError>) -> bool {
        if r.is_err() {
            let n = field(&nullifier_hash, "nullifier hash");
            self.nullifiers.remove(&be(&n));
            log!("Pocket pool: payout failed, the note can be used again");
            return false;
        }
        true
    }

    // ---------- views ----------

    pub fn get_info(&self) -> PoolInfo {
        PoolInfo {
            denomination: U128(self.denomination),
            levels: LEVELS,
            leaves: self.leaves.len(),
            root: from_be(&self.roots[self.root_index as usize]).to_string(),
        }
    }

    /// Leaves in order, so a phone can rebuild the tree and its Merkle path.
    pub fn get_leaves(&self, from: u32, limit: u32) -> Vec<String> {
        let end = self.leaves.len().min(from.saturating_add(limit.min(500)));
        (from..end).map(|i| from_be(self.leaves.get(i).unwrap()).to_string()).collect()
    }

    pub fn is_known_root(&self, root: String) -> bool {
        groth16::dec(&root).map(|r| self.roots.contains(&be(&r))).unwrap_or(false)
    }

    pub fn is_spent(&self, nullifier_hash: String) -> bool {
        groth16::dec(&nullifier_hash).map(|n| self.nullifiers.contains(&be(&n))).unwrap_or(false)
    }

    pub fn get_verifying_key(&self) -> VerifyingKey {
        self.vk.clone()
    }
}

#[cfg(test)]
mod tests;
