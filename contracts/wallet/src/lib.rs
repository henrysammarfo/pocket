//! Pocket wallet: the spending rules live in the account itself.
//!
//! This contract is deployed on every Pocket user account (as a NEAR global contract, by code
//! hash, so it cannot be swapped under a user). The phone holds only a function call access key
//! that may call this account and only the methods below marked "device". Money leaves the
//! account only through these methods, and each one checks the rules before any money moves:
//!
//! * per send cap and rolling 24 hour cap for dollars (pUSD inside the NEAR Intents verifier and
//!   Circle testnet USDC count as one dollar bucket, 6 decimals each),
//! * per send cap and rolling 24 hour cap for NEAR,
//! * per send cap and rolling 24 hour cap for each other verifier token (paper stocks); a token
//!   with no cap cannot be sent at all,
//! * which kinds of send are allowed, an optional allow list of receivers, and a block list,
//! * trades go only to the Pocket maker contract fixed at init, and a buy is capped per trade.
//!
//! A call that breaks a rule panics, so nothing changes and no money moves. The amount is
//! reserved before the outgoing call and given back in the callback if that call fails, so many
//! sends at once can never pass the 24 hour cap (NEAR runs the calls to one account one at a time).
//!
//! Changing the rules: anyone holding one of this account's keys may make them stricter at once
//! (`lower_limits`). Making any rule looser needs a message signed by an owner key (the recovery
//! key, never stored on the phone) and only takes effect after the current raise delay.
//!
//! Version 2 (no full access key at all):
//! * The recovery key is not an access key. It signs owner messages (`owner_action`), and the
//!   contract checks that ed25519 signature itself, with a nonce, so the check holds even when a
//!   relayer submits the call. Nobody, not Pocket and not a thief with the phone, can deploy other
//!   code or delete the account, because no key on the account can.
//! * The owner can add or remove phone keys at once (restore a lost phone), but replacing the owner
//!   keys or loosening a rule waits for the raise delay, and any phone key can cancel it. A stolen
//!   recovery key therefore gives the thief no more than a phone key, plus a day's warning.
//! * NEAR and paper stock sends also count against the dollar caps, at a price signed by Pocket's
//!   price key and at most ten minutes old (`price`). Without a valid price they are refused.

use near_sdk::json_types::U128;
use near_sdk::Allowance;
use near_sdk::store::LookupMap;
use near_sdk::{
    env, ext_contract, log, near, require, AccountId, BorshStorageKey, Gas, NearToken,
    PanicOnDefault, Promise, PromiseError, PublicKey,
};

const HOUR_NS: u64 = 3_600 * 1_000_000_000;
const WINDOW_HOURS: u64 = 24;
const MAX_LIST: usize = 64;
const MAX_TOKENS: usize = 32;
const MAX_OWNER_KEYS: usize = 4;
const MAX_RAISE_DELAY_SEC: u64 = 30 * 24 * 3600;
const MAX_MEMO: usize = 256;
const MAX_TRADE_MSG: usize = 4096;
const MAX_OWNER_MSG: usize = 8192;
const MAX_PRICE_AGE_MS: u64 = 10 * 60 * 1000;
/// Owner messages and prices are signed over these prefixes, so neither can be replayed as the
/// other, as a NEP-413 message, or as a NEAR transaction.
const OWNER_TAG: &[u8] = b"pocket.wallet.owner.v1\n";
const PRICE_TAG: &[u8] = b"pocket.price.v1\n";
/// Phone keys the owner adds: this account only, these methods, a 0.25 NEAR gas allowance.
pub const DEVICE_METHODS: [&str; 8] = ["send_near", "send_usdc", "send_token", "trade", "lower_limits", "cancel_pending", "owner_action", "send_private"];
const DEVICE_ALLOWANCE: NearToken = NearToken::from_millinear(250);
/// NEAR kept back on a NEAR send, on top of what storage needs, so the account can always pay
/// the 1 yocto deposits and stay usable.
const NEAR_RESERVE: NearToken = NearToken::from_millinear(10);

const GAS_SEND: Gas = Gas::from_tgas(15);
const GAS_CALLBACK: Gas = Gas::from_tgas(12);
const GAS_TRADE: Gas = Gas::from_tgas(150);
const MIN_GAS_SEND: Gas = Gas::from_tgas(40);
const MIN_GAS_TRADE: Gas = Gas::from_tgas(200);
const GAS_POOL: Gas = Gas::from_tgas(120);
const MIN_GAS_POOL: Gas = Gas::from_tgas(160);

#[ext_contract(ext_ft)]
#[allow(dead_code)]
trait FungibleToken {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
}

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
    fn mt_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        amount: U128,
        approval: Option<(AccountId, u64)>,
        memo: Option<String>,
        msg: String,
    ) -> Vec<U128>;
}

#[ext_contract(ext_pool)]
#[allow(dead_code)]
trait PrivatePool {
    fn deposit(&mut self, commitment: String) -> u32;
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct TokenCap {
    pub token_id: String,
    pub per_send: U128,
    pub per_day: U128,
}

/// Every rule in one place. Amounts are in the smallest unit: dollars with 6 decimals,
/// NEAR in yocto, stock tokens in their own units.
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Limits {
    pub usd_per_send: U128,
    pub usd_per_day: U128,
    pub near_per_send: U128,
    pub near_per_day: U128,
    pub token_caps: Vec<TokenCap>,
    pub max_trade_usd: U128,
    pub allow_near: bool,
    pub allow_usdc: bool,
    pub allow_tokens: bool,
    pub allow_trade: bool,
    /// When set, sends may go only to these accounts.
    pub allow_only: Option<Vec<AccountId>>,
    /// Sends to these accounts are always refused.
    pub blocked: Vec<AccountId>,
    /// How long a looser rule waits before it takes effect.
    pub raise_delay_sec: u64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq)]
pub struct Pending {
    pub limits: Limits,
    pub effective_at_ns: u64,
    /// A waiting replacement of the owner keys, if any.
    pub owner_keys: Option<Vec<PublicKey>>,
}

/// What an owner message may ask for.
#[near(serializers = [json])]
#[serde(rename_all = "snake_case")]
pub enum OwnerAction {
    /// Stricter applies at once; looser waits for the raise delay.
    SetLimits { limits: Limits },
    /// Add a phone key (restore on a new phone). At once.
    AddDeviceKey { public_key: PublicKey },
    /// Remove a key from this account (a lost phone). At once.
    RemoveKey { public_key: PublicKey },
    /// Replace the owner keys (for example add a guardian). Waits for the raise delay.
    SetOwnerKeys { owner_keys: Vec<PublicKey> },
    CancelPending,
}

#[near(serializers = [json])]
pub struct OwnerMsg {
    pub account: AccountId,
    pub nonce: u64,
    pub action: OwnerAction,
}

/// A price signed by Pocket's price key: micro dollars for one whole unit of `token`.
#[near(serializers = [json])]
#[derive(Clone)]
pub struct SignedPrice {
    /// The exact JSON that was signed: {"v":1,"token":"near"|token id,"micro_usd":"..","decimals":n,"expires_ms":n}
    pub payload: String,
    /// Hex ed25519 signature over PRICE_TAG + payload.
    pub signature: String,
}

#[near(serializers = [json])]
struct PricePayload {
    v: u8,
    token: String,
    micro_usd: U128,
    decimals: u8,
    expires_ms: u64,
}

/// Amounts spent per clock hour, for the last 24 hours only.
#[near(serializers = [borsh])]
#[derive(Clone, Debug, Default)]
pub struct Window {
    slots: Vec<(u64, u128)>,
}

impl Window {
    fn live(hour: u64, now_hour: u64) -> bool {
        hour <= now_hour && hour + WINDOW_HOURS > now_hour
    }
    pub fn spent(&self, now_hour: u64) -> u128 {
        self.slots
            .iter()
            .filter(|(h, _)| Self::live(*h, now_hour))
            .fold(0u128, |a, (_, v)| a.saturating_add(*v))
    }
    fn add(&mut self, now_hour: u64, amount: u128) {
        self.slots.retain(|(h, _)| Self::live(*h, now_hour));
        match self.slots.iter_mut().find(|(h, _)| *h == now_hour) {
            Some(slot) => {
                slot.1 = slot.1.checked_add(amount).unwrap_or_else(|| env::panic_str("Amount overflow."))
            }
            None => self.slots.push((now_hour, amount)),
        }
    }
    fn give_back(&mut self, hour: u64, amount: u128) {
        if let Some(slot) = self.slots.iter_mut().find(|(h, _)| *h == hour) {
            slot.1 = slot.1.saturating_sub(amount);
        }
    }
}

#[derive(BorshStorageKey)]
#[near]
enum StorageKey {
    Windows,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Wallet {
    owner_keys: Vec<PublicKey>,
    verifier: AccountId,
    usdc: AccountId,
    maker: AccountId,
    dollar_tokens: Vec<String>,
    limits: Limits,
    pending: Option<Pending>,
    windows: LookupMap<String, Window>,
    owner_nonce: u64,
    price_key: PublicKey,
    /// The Pocket private pool (contracts/pool), fixed at init. None means private sends are off.
    pool: Option<AccountId>,
}

#[near(serializers = [json])]
pub struct Config {
    pub owner_keys: Vec<PublicKey>,
    pub verifier: AccountId,
    pub usdc: AccountId,
    pub maker: AccountId,
    pub dollar_tokens: Vec<String>,
    pub owner_nonce: u64,
    pub price_key: PublicKey,
    pub pool: Option<AccountId>,
}

#[near(serializers = [json])]
pub struct Spent {
    pub usd: U128,
    pub near: U128,
    pub tokens: Vec<(String, U128)>,
}

fn validate(l: &Limits) {
    require!(l.token_caps.len() <= MAX_TOKENS, "Too many token caps.");
    require!(l.blocked.len() <= MAX_LIST, "Block list too long.");
    if let Some(a) = &l.allow_only {
        require!(a.len() <= MAX_LIST, "Allow list too long.");
    }
    require!(l.raise_delay_sec <= MAX_RAISE_DELAY_SEC, "Raise delay is at most 30 days.");
    for (i, t) in l.token_caps.iter().enumerate() {
        require!(!t.token_id.is_empty() && t.token_id.len() <= 128, "Bad token id.");
        require!(
            !l.token_caps[..i].iter().any(|o| o.token_id == t.token_id),
            "Each token may have one cap."
        );
    }
}

/// True when `new` loosens anything compared with `old`.
pub fn is_raise(new: &Limits, old: &Limits) -> bool {
    let num = new.usd_per_send.0 > old.usd_per_send.0
        || new.usd_per_day.0 > old.usd_per_day.0
        || new.near_per_send.0 > old.near_per_send.0
        || new.near_per_day.0 > old.near_per_day.0
        || new.max_trade_usd.0 > old.max_trade_usd.0
        || new.raise_delay_sec < old.raise_delay_sec;
    let flags = (new.allow_near && !old.allow_near)
        || (new.allow_usdc && !old.allow_usdc)
        || (new.allow_tokens && !old.allow_tokens)
        || (new.allow_trade && !old.allow_trade);
    let tokens = new.token_caps.iter().any(|n| {
        match old.token_caps.iter().find(|o| o.token_id == n.token_id) {
            None => true,
            Some(o) => n.per_send.0 > o.per_send.0 || n.per_day.0 > o.per_day.0,
        }
    });
    let allow = match (&new.allow_only, &old.allow_only) {
        (_, None) => false,
        (None, Some(_)) => true,
        (Some(n), Some(o)) => n.iter().any(|a| !o.contains(a)),
    };
    let blocked = old.blocked.iter().any(|b| !new.blocked.contains(b));
    num || flags || tokens || allow || blocked
}

fn now_hour() -> u64 {
    env::block_timestamp() / HOUR_NS
}

fn parent_of(account: &AccountId) -> Option<&str> {
    account.as_str().split_once('.').map(|(_, p)| p)
}

/// Lowercase or uppercase hex to bytes (smaller code than a base64 decoder).
fn unhex(s: &str) -> Option<Vec<u8>> {
    let b = s.as_bytes();
    if b.len() % 2 != 0 {
        return None;
    }
    let v = |c: u8| match c { b'0'..=b'9' => Some(c - b'0'), b'a'..=b'f' => Some(c - b'a' + 10), b'A'..=b'F' => Some(c - b'A' + 10), _ => None };
    b.chunks(2).map(|p| Some(v(p[0])? << 4 | v(p[1])?)).collect()
}

/// ed25519 check of `sig` (hex) over `tag + msg` against `pk`.
fn verify(tag: &[u8], msg: &str, sig: &str, pk: &PublicKey) -> bool {
    if pk.curve_type() != near_sdk::CurveType::ED25519 {
        return false;
    }
    let Some(sig) = unhex(sig) else { return false };
    let Ok(sig): Result<[u8; 64], _> = sig.try_into() else { return false };
    let Ok(pk): Result<[u8; 32], _> = pk.as_bytes()[1..].try_into() else { return false };
    let mut m = tag.to_vec();
    m.extend_from_slice(msg.as_bytes());
    env::ed25519_verify(&sig, &m, &pk)
}

fn check_owner_keys(keys: &[PublicKey]) {
    require!(!keys.is_empty() && keys.len() <= MAX_OWNER_KEYS, "One to four owner keys.");
    require!(keys.iter().all(|k| k.curve_type() == near_sdk::CurveType::ED25519), "Owner keys must be ed25519.");
}

#[near]
impl Wallet {
    /// Set up the wallet. Only the account itself or the account that created it (Pocket's
    /// sponsor, in the same signup transaction) may call this, and only once.
    #[init]
    pub fn new(
        owner_keys: Vec<PublicKey>,
        verifier: AccountId,
        usdc: AccountId,
        maker: AccountId,
        dollar_tokens: Vec<String>,
        limits: Limits,
        price_key: PublicKey,
        pool: Option<AccountId>,
    ) -> Self {
        let me = env::current_account_id();
        let caller = env::predecessor_account_id();
        require!(
            caller == me || parent_of(&me) == Some(caller.as_str()),
            "Only this account or its parent can set it up."
        );
        check_owner_keys(&owner_keys);
        require!(price_key.curve_type() == near_sdk::CurveType::ED25519, "Price key must be ed25519.");
        require!(dollar_tokens.len() <= 4, "At most four dollar tokens.");
        validate(&limits);
        Self {
            owner_keys,
            verifier,
            usdc,
            maker,
            dollar_tokens,
            limits,
            pending: None,
            windows: LookupMap::new(StorageKey::Windows),
            owner_nonce: 0,
            price_key,
            pool,
        }
    }

    // ---------- helpers ----------

    fn assert_self(&self) {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "Only this account's own keys can do this."
        );
    }

    /// Owner only. Two cases:
    /// * A transaction this account signs itself: the signing key must be an owner key.
    /// * A gasless meta transaction (NEP-366): NEAR reports the relayer as the signer, so the
    ///   contract cannot see the user's key. The guard is then the access key itself: the phone's
    ///   function call key does not list these methods, so the chain refuses its delegate before
    ///   this code runs. Only a full access key (the recovery key) can sign such a call, and only a
    ///   full access key can add keys.
    fn assert_owner(&self) {
        self.assert_self();
        if env::signer_account_id() == env::current_account_id() {
            require!(
                self.owner_keys.contains(&env::signer_account_pk()),
                "Only an owner key (the recovery key) can loosen the rules."
            );
        }
    }

    /// A looser rule whose delay has passed becomes the rule.
    fn settle_pending(&mut self) {
        if let Some(p) = &self.pending {
            if env::block_timestamp() >= p.effective_at_ns {
                self.limits = p.limits.clone();
                if let Some(k) = &p.owner_keys {
                    self.owner_keys = k.clone();
                    log!("Pocket: new owner keys are now in effect");
                }
                self.pending = None;
                log!("Pocket: new limits are now in effect");
            }
        }
    }

    fn effective(&self) -> &Limits {
        match &self.pending {
            Some(p) if env::block_timestamp() >= p.effective_at_ns => &p.limits,
            _ => &self.limits,
        }
    }

    fn check_receiver(&self, receiver_id: &AccountId) {
        require!(receiver_id != &env::current_account_id(), "You cannot send to yourself.");
        let l = &self.limits;
        require!(!l.blocked.contains(receiver_id), "That receiver is blocked by your rules.");
        if let Some(a) = &l.allow_only {
            require!(a.contains(receiver_id), "Your rules only allow sends to your saved list.");
        }
    }

    fn check_memo(memo: &Option<String>) {
        if let Some(m) = memo {
            require!(m.len() <= MAX_MEMO, "Memo is too long.");
        }
    }

    /// Check one send against a per send cap and the rolling 24 hour cap, then reserve it.
    fn reserve(&mut self, key: &str, amount: u128, per_send: u128, per_day: u128, what: &str) -> u64 {
        require!(amount > 0, "Amount must be above zero.");
        if amount > per_send {
            env::panic_str(&format!("Over your per send limit for {}.", what));
        }
        let hour = now_hour();
        let mut w = self.windows.get(key).cloned().unwrap_or_default();
        let total = w.spent(hour).checked_add(amount).unwrap_or_else(|| env::panic_str("Amount overflow."));
        if total > per_day {
            env::panic_str(&format!("Over your 24 hour limit for {}.", what));
        }
        w.add(hour, amount);
        self.windows.insert(key.to_string(), w);
        hour
    }

    fn after(&self, key: String, hour: u64, amount: u128, usd: u128) -> Promise {
        Self::ext(env::current_account_id())
            .with_static_gas(GAS_CALLBACK)
            .on_sent(key, hour, U128(amount), if usd > 0 { Some(U128(usd)) } else { None })
    }

    /// Dollar value of `amount` of `token` at a price Pocket signed less than ten minutes ago.
    /// Refuses a missing, foreign, stale or wrong token price.
    fn dollars_of(&self, token: &str, amount: u128, price: &Option<SignedPrice>) -> u128 {
        let p = price.as_ref().unwrap_or_else(|| env::panic_str("This send needs a current price from Pocket."));
        require!(p.payload.len() <= 512, "Bad price.");
        require!(verify(PRICE_TAG, &p.payload, &p.signature, &self.price_key), "That price is not signed by Pocket.");
        let x: PricePayload = near_sdk::serde_json::from_slice(p.payload.as_bytes()).unwrap_or_else(|_| env::panic_str("Bad price."));
        require!(x.v == 1 && x.token == token, "That price is for another token.");
        let now = env::block_timestamp_ms();
        require!(x.expires_ms >= now && x.expires_ms <= now + MAX_PRICE_AGE_MS, "That price is too old. Try again.");
        require!(x.decimals <= 30, "Bad price.");
        let v = amount.checked_mul(x.micro_usd.0).unwrap_or_else(|| env::panic_str("Amount overflow."));
        v / 10u128.pow(x.decimals as u32)
    }

    /// Reserve the dollar value too, for NEAR and stock sends.
    fn reserve_usd(&mut self, usd: u128) {
        if usd == 0 {
            return;
        }
        let (ps, pd) = (self.limits.usd_per_send.0, self.limits.usd_per_day.0);
        self.reserve("usd", usd, ps, pd, "dollars");
    }

    fn need_gas(min: Gas) {
        require!(env::prepaid_gas() >= min, "Attach more gas.");
    }

    // ---------- device: sends ----------

    /// Send NEAR. Device.
    pub fn send_near(&mut self, receiver_id: AccountId, amount: U128, price: Option<SignedPrice>) -> Promise {
        self.assert_self();
        Self::need_gas(MIN_GAS_SEND);
        self.settle_pending();
        require!(self.limits.allow_near, "NEAR sends are off in your rules.");
        self.check_receiver(&receiver_id);
        let storage = env::storage_byte_cost().saturating_mul(env::storage_usage() as u128);
        let keep = storage.saturating_add(NEAR_RESERVE).as_yoctonear();
        require!(
            env::account_balance().as_yoctonear() >= amount.0.saturating_add(keep),
            "Not enough NEAR left after what this account must keep."
        );
        let (ps, pd) = (self.limits.near_per_send.0, self.limits.near_per_day.0);
        let hour = self.reserve("near", amount.0, ps, pd, "NEAR");
        let usd = self.dollars_of("near", amount.0, &price);
        self.reserve_usd(usd);
        Promise::new(receiver_id)
            .transfer(NearToken::from_yoctonear(amount.0))
            .then(self.after("near".into(), hour, amount.0, usd))
    }

    /// Move NEAR into the private pool as one note. The same rules as `send_near` apply first (NEAR on, the
    /// pool not blocked and on the allow list if one is set, per send and 24 hour NEAR caps, and the dollar
    /// caps at a signed price), so a private send can never pass the limits. The pool takes exactly one
    /// note's amount and the commitment the phone made. Device.
    pub fn send_private(&mut self, commitment: String, amount: U128, price: Option<SignedPrice>) -> Promise {
        self.assert_self();
        Self::need_gas(MIN_GAS_POOL);
        self.settle_pending();
        let pool = self.pool.clone().unwrap_or_else(|| env::panic_str("Private sends are not set up for this wallet."));
        require!(self.limits.allow_near, "NEAR sends are off in your rules.");
        require!(commitment.len() <= 80, "Bad commitment.");
        self.check_receiver(&pool);
        let storage = env::storage_byte_cost().saturating_mul(env::storage_usage() as u128);
        let keep = storage.saturating_add(NEAR_RESERVE).as_yoctonear();
        require!(
            env::account_balance().as_yoctonear() >= amount.0.saturating_add(keep),
            "Not enough NEAR left after what this account must keep."
        );
        let (ps, pd) = (self.limits.near_per_send.0, self.limits.near_per_day.0);
        let hour = self.reserve("near", amount.0, ps, pd, "NEAR");
        let usd = self.dollars_of("near", amount.0, &price);
        self.reserve_usd(usd);
        ext_pool::ext(pool)
            .with_attached_deposit(NearToken::from_yoctonear(amount.0))
            .with_static_gas(GAS_POOL)
            .deposit(commitment)
            .then(self.after("near".into(), hour, amount.0, usd))
    }

    /// Send Circle testnet USDC. Counts against the dollar caps. Device.
    pub fn send_usdc(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) -> Promise {
        self.assert_self();
        Self::need_gas(MIN_GAS_SEND);
        self.settle_pending();
        require!(self.limits.allow_usdc, "USDC sends are off in your rules.");
        self.check_receiver(&receiver_id);
        Self::check_memo(&memo);
        let (ps, pd) = (self.limits.usd_per_send.0, self.limits.usd_per_day.0);
        let hour = self.reserve("usd", amount.0, ps, pd, "dollars");
        ext_ft::ext(self.usdc.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_SEND)
            .ft_transfer(receiver_id, amount, memo)
            .then(self.after("usd".into(), hour, amount.0, 0))
    }

    /// Send a token held inside the NEAR Intents verifier (pUSD or a paper stock). Device.
    pub fn send_token(&mut self, token_id: String, receiver_id: AccountId, amount: U128, memo: Option<String>, price: Option<SignedPrice>) -> Promise {
        self.assert_self();
        Self::need_gas(MIN_GAS_SEND);
        self.settle_pending();
        require!(self.limits.allow_tokens, "Token sends are off in your rules.");
        self.check_receiver(&receiver_id);
        Self::check_memo(&memo);
        let (key, ps, pd, what) = if self.dollar_tokens.contains(&token_id) {
            ("usd".to_string(), self.limits.usd_per_send.0, self.limits.usd_per_day.0, "dollars".to_string())
        } else {
            let cap = self
                .limits
                .token_caps
                .iter()
                .find(|c| c.token_id == token_id)
                .unwrap_or_else(|| env::panic_str("That token has no limit set, so it cannot be sent."));
            (format!("t:{}", token_id), cap.per_send.0, cap.per_day.0, token_id.clone())
        };
        let hour = self.reserve(&key, amount.0, ps, pd, &what);
        let usd = if key == "usd" { 0 } else { self.dollars_of(&token_id, amount.0, &price) };
        self.reserve_usd(usd);
        ext_mt::ext(self.verifier.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_SEND)
            .mt_transfer(receiver_id, token_id, amount, None, memo)
            .then(self.after(key, hour, amount.0, usd))
    }

    /// Paper trade with the Pocket maker contract. The pay tokens go to the maker inside the
    /// verifier with a quote Pocket signed; the maker pays back in the same flow or the verifier
    /// refunds. Trades never send to anyone but the maker. A buy is capped per trade. Device.
    pub fn trade(&mut self, pay_token: String, pay_amount: U128, msg: String) -> Promise {
        self.assert_self();
        Self::need_gas(MIN_GAS_TRADE);
        self.settle_pending();
        require!(self.limits.allow_trade, "Trades are off in your rules.");
        require!(pay_amount.0 > 0, "Amount must be above zero.");
        require!(msg.len() <= MAX_TRADE_MSG, "Trade message too long.");
        if self.dollar_tokens.contains(&pay_token) {
            require!(pay_amount.0 <= self.limits.max_trade_usd.0, "Over your per trade limit.");
        } else {
            require!(
                self.limits.token_caps.iter().any(|c| c.token_id == pay_token),
                "Unknown token for a trade."
            );
        }
        ext_mt::ext(self.verifier.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_TRADE)
            .mt_transfer_call(self.maker.clone(), pay_token.clone(), pay_amount, None, None, msg)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_CALLBACK)
                    .on_trade(pay_token, pay_amount),
            )
    }

    // ---------- callbacks ----------

    /// Give the reserved amount back if the outgoing call failed.
    #[private]
    pub fn on_sent(&mut self, key: String, hour: u64, amount: U128, usd: Option<U128>) -> bool {
        // #[private] only checks the caller is this account, which its own keys also are.
        // A real callback always has exactly one promise result; a direct call has none.
        require!(env::promise_results_count() == 1, "Callback only.");
        // A result too long to read still means the call succeeded, so it stays counted.
        let ok = !matches!(env::promise_result_checked(0, 64), Err(PromiseError::Failed));
        if !ok {
            if let Some(mut w) = self.windows.get(&key).cloned() {
                w.give_back(hour, amount.0);
                self.windows.insert(key, w);
            }
            if let Some(u) = usd {
                if let Some(mut w) = self.windows.get("usd").cloned() {
                    w.give_back(hour, u.0);
                    self.windows.insert("usd".to_string(), w);
                }
            }
            log!("Pocket: the send failed, so it does not count against your limit");
        }
        ok
    }

    #[private]
    pub fn on_trade(&mut self, pay_token: String, pay_amount: U128) -> U128 {
        require!(env::promise_results_count() == 1, "Callback only.");
        let used = match env::promise_result_checked(0, 256) {
            Ok(v) => near_sdk::serde_json::from_slice::<Vec<U128>>(&v)
                .ok()
                .and_then(|u| u.first().copied())
                .unwrap_or(U128(0)),
            _ => U128(0),
        };
        if used.0 == 0 {
            log!("Pocket: trade refunded, {} {} came back", pay_amount.0, pay_token);
        }
        used
    }

    // ---------- rules ----------

    /// Make the rules stricter, at once. Any key of this account may do this. It also cancels a
    /// looser change that is still waiting. Device.
    pub fn lower_limits(&mut self, limits: Limits) {
        self.assert_self();
        self.settle_pending();
        validate(&limits);
        require!(!is_raise(&limits, &self.limits), "That loosens a rule. Use your recovery key.");
        self.limits = limits;
        if self.pending.take().is_some() {
            log!("Pocket: a waiting raise was cancelled");
        }
        log!("Pocket: stricter limits are in effect now");
    }

    /// Change the rules with an owner key. Stricter changes apply at once; looser ones wait for
    /// the current raise delay.
    pub fn propose_limits(&mut self, limits: Limits) {
        self.assert_owner();
        self.settle_pending();
        self.apply_owner_limits(limits);
    }

    fn apply_owner_limits(&mut self, limits: Limits) {
        validate(&limits);
        if !is_raise(&limits, &self.limits) {
            self.limits = limits;
            self.pending = None;
            log!("Pocket: stricter limits are in effect now");
            return;
        }
        let delay_ns = self.limits.raise_delay_sec.saturating_mul(1_000_000_000);
        let at = env::block_timestamp().saturating_add(delay_ns);
        self.pending = Some(Pending { limits, effective_at_ns: at, owner_keys: None });
        if delay_ns == 0 {
            self.settle_pending();
        } else {
            log!("Pocket: looser limits wait {} seconds", self.limits.raise_delay_sec);
        }
    }

    /// Cancel a looser change that is still waiting. Any key of this account may do this. Device.
    pub fn cancel_pending(&mut self) {
        self.assert_self();
        self.settle_pending();
        require!(self.pending.take().is_some(), "Nothing is waiting.");
        log!("Pocket: a waiting raise was cancelled");
    }

    /// Replace the owner keys with a direct call from an owner access key (accounts from before
    /// version 2). Waits for the raise delay like any loosening. Owner only.
    pub fn set_owner_keys(&mut self, owner_keys: Vec<PublicKey>) {
        self.assert_owner();
        self.settle_pending();
        check_owner_keys(&owner_keys);
        self.queue_owner_keys(owner_keys);
    }

    fn queue_owner_keys(&mut self, owner_keys: Vec<PublicKey>) {
        let delay_ns = self.limits.raise_delay_sec.saturating_mul(1_000_000_000);
        let limits = self.pending.as_ref().map(|p| p.limits.clone()).unwrap_or_else(|| self.limits.clone());
        self.pending = Some(Pending { limits, effective_at_ns: env::block_timestamp().saturating_add(delay_ns), owner_keys: Some(owner_keys) });
        log!("Pocket: new owner keys wait {} seconds; any phone key can cancel", self.limits.raise_delay_sec);
        self.settle_pending();
    }

    /// An action signed by an owner key (the recovery key). Anyone may submit it, a phone key or
    /// Pocket's relayer, because the contract checks the owner's ed25519 signature over
    /// `pocket.wallet.owner.v1\n` + `payload` itself, plus a nonce that must go up by exactly one.
    pub fn owner_action(&mut self, payload: String, public_key: PublicKey, signature: String) {
        require!(payload.len() <= MAX_OWNER_MSG, "Owner message too long.");
        require!(self.owner_keys.contains(&public_key), "That is not an owner key of this account.");
        require!(verify(OWNER_TAG, &payload, &signature, &public_key), "Bad owner signature.");
        let m: OwnerMsg = near_sdk::serde_json::from_slice(payload.as_bytes()).unwrap_or_else(|_| env::panic_str("Bad owner message."));
        require!(m.account == env::current_account_id(), "That message is for another account.");
        require!(m.nonce == self.owner_nonce + 1, "Old or out of order owner message.");
        self.owner_nonce = m.nonce;
        self.settle_pending();
        match m.action {
            OwnerAction::SetLimits { limits } => self.apply_owner_limits(limits),
            OwnerAction::AddDeviceKey { public_key } => {
                require!(public_key.curve_type() == near_sdk::CurveType::ED25519, "Phone keys must be ed25519.");
                let allowance = Allowance::limited(DEVICE_ALLOWANCE).unwrap_or_else(|| env::panic_str("Bad allowance."));
                Promise::new(env::current_account_id()).add_access_key_allowance(public_key, allowance, env::current_account_id(), DEVICE_METHODS.join(",")).detach();
                log!("Pocket: a new phone key was added");
            }
            OwnerAction::RemoveKey { public_key } => {
                Promise::new(env::current_account_id()).delete_key(public_key).detach();
                log!("Pocket: a key was removed");
            }
            OwnerAction::SetOwnerKeys { owner_keys } => {
                check_owner_keys(&owner_keys);
                self.queue_owner_keys(owner_keys);
            }
            OwnerAction::CancelPending => {
                require!(self.pending.take().is_some(), "Nothing is waiting.");
                log!("Pocket: a waiting change was cancelled");
            }
        }
    }

    // ---------- views ----------

    pub fn get_limits(&self) -> Limits {
        self.effective().clone()
    }

    pub fn get_pending(&self) -> Option<Pending> {
        match &self.pending {
            Some(p) if env::block_timestamp() < p.effective_at_ns => Some(p.clone()),
            _ => None,
        }
    }

    pub fn get_config(&self) -> Config {
        Config {
            owner_keys: self.owner_keys.clone(),
            verifier: self.verifier.clone(),
            usdc: self.usdc.clone(),
            maker: self.maker.clone(),
            dollar_tokens: self.dollar_tokens.clone(),
            owner_nonce: self.owner_nonce,
            price_key: self.price_key.clone(),
            pool: self.pool.clone(),
        }
    }

    /// What was sent in the last 24 hours (rolling, counted per clock hour).
    pub fn get_spent(&self) -> Spent {
        let h = now_hour();
        let get = |k: &str| U128(self.windows.get(k).map(|w| w.spent(h)).unwrap_or(0));
        Spent {
            usd: get("usd"),
            near: get("near"),
            tokens: self
                .effective()
                .token_caps
                .iter()
                .map(|c| (c.token_id.clone(), get(&format!("t:{}", c.token_id))))
                .collect(),
        }
    }
}

#[cfg(test)]
mod tests;
