//! Pocket maker: settles paper trades inside the NEAR Intents verifier, all or nothing.
//!
//! A Pocket wallet pays with `verifier.mt_transfer_call(maker, pay_token, pay_units, msg)`, where
//! `msg` holds a quote that Pocket's quote key signed. The verifier calls `mt_on_transfer` here.
//! If the quote is good (right signature, right payer, right token and amount, not expired, not
//! used before) the maker sends the bought tokens back to the payer inside the verifier. If
//! anything is wrong, or that payment fails, this returns the full amount as a refund and the
//! verifier gives the payer's tokens back. The payer never ends up with neither.

use near_sdk::json_types::U128;
use near_sdk::store::LookupSet;
use near_sdk::{
    env, ext_contract, log, near, require, AccountId, BorshStorageKey, Gas, NearToken,
    PanicOnDefault, Promise, PromiseError, PromiseOrValue, PublicKey,
};

const GAS_PAY: Gas = Gas::from_tgas(20);
const GAS_CALLBACK: Gas = Gas::from_tgas(10);

#[ext_contract(ext_mt)]
#[allow(dead_code)]
trait MultiToken {
    fn mt_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        amount: U128,
        approval: Option<(AccountId, u64)>,
        memo: Option<String>,
    );
}

#[near(serializers = [json])]
pub struct Quote {
    pub v: u8,
    pub maker: AccountId,
    pub id: String,
    pub account: AccountId,
    pub pay_token: String,
    pub pay_units: U128,
    pub get_token: String,
    pub get_units: U128,
    pub deadline_ms: u64,
}

#[near(serializers = [json])]
pub struct TradeMsg {
    /// The quote as the exact JSON string that was signed.
    pub quote: String,
    /// ed25519 signature over the bytes of `quote`, base64.
    pub signature: String,
}

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    Used,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Maker {
    owner: AccountId,
    verifier: AccountId,
    quote_key: PublicKey,
    used: LookupSet<String>,
    paused: bool,
}

#[near(serializers = [json])]
pub struct Config {
    pub owner: AccountId,
    pub verifier: AccountId,
    pub quote_key: PublicKey,
    pub paused: bool,
}

fn parent_of(account: &AccountId) -> Option<&str> {
    account.as_str().split_once('.').map(|(_, p)| p)
}

fn b64(s: &str) -> Option<Vec<u8>> {
    near_sdk::base64::Engine::decode(&near_sdk::base64::engine::general_purpose::STANDARD, s).ok()
}

#[near]
impl Maker {
    #[init]
    pub fn new(owner: AccountId, verifier: AccountId, quote_key: PublicKey) -> Self {
        let me = env::current_account_id();
        let caller = env::predecessor_account_id();
        require!(caller == me || parent_of(&me) == Some(caller.as_str()), "Only this account or its parent.");
        require!(quote_key.curve_type() == near_sdk::CurveType::ED25519, "Quote key must be ed25519.");
        Self { owner, verifier, quote_key, used: LookupSet::new(StorageKey::Used), paused: false }
    }

    /// Check a trade message. Returns the quote when every rule holds, or the reason it fails.
    fn check(&self, sender_id: &AccountId, token_ids: &[String], amounts: &[U128], msg: &str) -> Result<Quote, String> {
        if self.paused {
            return Err("maker is paused".into());
        }
        if token_ids.len() != 1 || amounts.len() != 1 {
            return Err("one token per trade".into());
        }
        let m: TradeMsg = near_sdk::serde_json::from_str(msg).map_err(|_| "bad trade message".to_string())?;
        let sig = b64(&m.signature).ok_or("bad signature encoding")?;
        let sig: [u8; 64] = sig.try_into().map_err(|_| "bad signature length".to_string())?;
        let pk: [u8; 32] = self.quote_key.as_bytes()[1..].try_into().map_err(|_| "bad quote key".to_string())?;
        if !env::ed25519_verify(&sig, m.quote.as_bytes(), &pk) {
            return Err("quote signature is not Pocket's".into());
        }
        let q: Quote = near_sdk::serde_json::from_str(&m.quote).map_err(|_| "bad quote".to_string())?;
        if q.v != 1 || q.maker != env::current_account_id() {
            return Err("quote is for another maker".into());
        }
        if &q.account != sender_id {
            return Err("quote is for another account".into());
        }
        if q.pay_token != token_ids[0] || q.pay_units != amounts[0] {
            return Err("paid token or amount does not match the quote".into());
        }
        if q.get_units.0 == 0 || q.get_token == q.pay_token {
            return Err("bad quote amounts".into());
        }
        if env::block_timestamp_ms() > q.deadline_ms {
            return Err("quote expired".into());
        }
        if q.id.is_empty() || q.id.len() > 64 || self.used.contains(&q.id) {
            return Err("quote already used".into());
        }
        Ok(q)
    }

    /// NEP-245 receiver. Only the verifier may call it.
    pub fn mt_on_transfer(
        &mut self,
        sender_id: AccountId,
        previous_owner_ids: Vec<AccountId>,
        token_ids: Vec<String>,
        amounts: Vec<U128>,
        msg: String,
    ) -> PromiseOrValue<Vec<U128>> {
        require!(env::predecessor_account_id() == self.verifier, "Only the verifier.");
        let _ = previous_owner_ids;
        match self.check(&sender_id, &token_ids, &amounts, &msg) {
            Err(why) => {
                log!("Pocket maker: refund, {}", why);
                PromiseOrValue::Value(amounts)
            }
            Ok(q) => {
                self.used.insert(q.id.clone());
                let memo = format!("pocket trade {}", q.id);
                PromiseOrValue::Promise(
                    ext_mt::ext(self.verifier.clone())
                        .with_attached_deposit(NearToken::from_yoctonear(1))
                        .with_static_gas(GAS_PAY)
                        .mt_transfer(sender_id, q.get_token, q.get_units, None, Some(memo))
                        .then(Self::ext(env::current_account_id()).with_static_gas(GAS_CALLBACK).on_paid(amounts[0])),
                )
            }
        }
    }

    /// Refund the payer in full if the maker could not pay.
    #[private]
    pub fn on_paid(&mut self, amount: U128) -> Vec<U128> {
        require!(env::promise_results_count() == 1, "Callback only.");
        match env::promise_result_checked(0, 64) {
            Ok(_) | Err(PromiseError::TooLong(_)) => vec![U128(0)],
            _ => {
                log!("Pocket maker: could not pay, full refund");
                vec![amount]
            }
        }
    }

    fn assert_owner(&self) {
        require!(env::predecessor_account_id() == self.owner, "Owner only.");
    }

    pub fn set_quote_key(&mut self, quote_key: PublicKey) {
        self.assert_owner();
        require!(quote_key.curve_type() == near_sdk::CurveType::ED25519, "Quote key must be ed25519.");
        self.quote_key = quote_key;
    }

    pub fn set_paused(&mut self, paused: bool) {
        self.assert_owner();
        self.paused = paused;
    }

    /// Move maker inventory inside the verifier. Owner only, 1 yocto.
    #[payable]
    pub fn withdraw(&mut self, token_id: String, amount: U128, receiver_id: AccountId) -> Promise {
        self.assert_owner();
        near_sdk::assert_one_yocto();
        ext_mt::ext(self.verifier.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_PAY)
            .mt_transfer(receiver_id, token_id, amount, None, None)
    }

    pub fn get_config(&self) -> Config {
        Config { owner: self.owner.clone(), verifier: self.verifier.clone(), quote_key: self.quote_key.clone(), paused: self.paused }
    }

    pub fn is_used(&self, id: String) -> bool {
        self.used.contains(&id)
    }
}

#[cfg(test)]
mod tests;
