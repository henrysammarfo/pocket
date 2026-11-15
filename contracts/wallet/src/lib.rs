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
//! (`lower_limits`). Making any rule looser needs a call signed by an owner key (the full access
//! recovery key, never stored on the phone) and only takes effect after the current raise delay.

use near_sdk::json_types::U128;
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
/// NEAR kept back on a NEAR send, on top of what storage needs, so the account can always pay
/// the 1 yocto deposits and stay usable.
const NEAR_RESERVE: NearToken = NearToken::from_millinear(10);

const GAS_SEND: Gas = Gas::from_tgas(15);
const GAS_CALLBACK: Gas = Gas::from_tgas(10);
const GAS_TRADE: Gas = Gas::from_tgas(150);
const MIN_GAS_SEND: Gas = Gas::from_tgas(40);
const MIN_GAS_TRADE: Gas = Gas::from_tgas(200);

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
}

#[near(serializers = [json])]
pub struct Config {
    pub owner_keys: Vec<PublicKey>,
    pub verifier: AccountId,
    pub usdc: AccountId,
    pub maker: AccountId,
    pub dollar_tokens: Vec<String>,
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
    ) -> Self {
        let me = env::current_account_id();
        let caller = env::predecessor_account_id();
        require!(
            caller == me || parent_of(&me) == Some(caller.as_str()),
            "Only this account or its parent can set it up."
        );
        require!(
            !owner_keys.is_empty() && owner_keys.len() <= MAX_OWNER_KEYS,
            "One to four owner keys."
        );
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

    fn after(&self, key: String, hour: u64, amount: u128) -> Promise {
        Self::ext(env::current_account_id())
            .with_static_gas(GAS_CALLBACK)
            .on_sent(key, hour, U128(amount))
    }

    fn need_gas(min: Gas) {
        require!(env::prepaid_gas() >= min, "Attach more gas.");
    }

    // ---------- device: sends ----------

    /// Send NEAR. Device.
    pub fn send_near(&mut self, receiver_id: AccountId, amount: U128) -> Promise {
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
        Promise::new(receiver_id)
            .transfer(NearToken::from_yoctonear(amount.0))
            .then(self.after("near".into(), hour, amount.0))
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
            .then(self.after("usd".into(), hour, amount.0))
    }

    /// Send a token held inside the NEAR Intents verifier (pUSD or a paper stock). Device.
    pub fn send_token(&mut self, token_id: String, receiver_id: AccountId, amount: U128, memo: Option<String>) -> Promise {
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
        ext_mt::ext(self.verifier.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_SEND)
            .mt_transfer(receiver_id, token_id, amount, None, memo)
            .then(self.after(key, hour, amount.0))
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
    pub fn on_sent(&mut self, key: String, hour: u64, amount: U128) -> bool {
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
        validate(&limits);
        if !is_raise(&limits, &self.limits) {
            self.limits = limits;
            self.pending = None;
            log!("Pocket: stricter limits are in effect now");
            return;
        }
        let delay_ns = self.limits.raise_delay_sec.saturating_mul(1_000_000_000);
        let at = env::block_timestamp().saturating_add(delay_ns);
        self.pending = Some(Pending { limits, effective_at_ns: at });
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

    /// Replace the owner keys. Owner only.
    pub fn set_owner_keys(&mut self, owner_keys: Vec<PublicKey>) {
        self.assert_owner();
        require!(
            !owner_keys.is_empty() && owner_keys.len() <= MAX_OWNER_KEYS,
            "One to four owner keys."
        );
        self.owner_keys = owner_keys;
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
