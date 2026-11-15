// Unit tests for the Pocket wallet rules. Each `#[should_panic]` test is a call the chain must
// refuse; a panic in a NEAR call means no state change and no money moved.
use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, NearToken, PromiseResult};

const USD: u128 = 1_000_000; // 6 decimals
const HOUR: u64 = 3_600 * 1_000_000_000;
const T0: u64 = 1_800_000_000 * 1_000_000_000;
const PUSD: &str = "nep141:pusd.pocket.testnet";
const TSLA: &str = "nep141:tslaon.pocket.testnet";

fn me() -> AccountId { "alice.pocket.testnet".parse().unwrap() }
fn root() -> AccountId { "pocket.testnet".parse().unwrap() }
fn bob() -> AccountId { "bob.testnet".parse().unwrap() }
fn eve() -> AccountId { "eve.testnet".parse().unwrap() }
fn owner_pk() -> PublicKey { "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp".parse().unwrap() }
fn device_pk() -> PublicKey { "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847".parse().unwrap() }

fn limits() -> Limits {
    Limits {
        usd_per_send: U128(100 * USD),
        usd_per_day: U128(200 * USD),
        near_per_send: U128(NearToken::from_near(1).as_yoctonear()),
        near_per_day: U128(NearToken::from_near(2).as_yoctonear()),
        token_caps: vec![TokenCap { token_id: TSLA.into(), per_send: U128(10), per_day: U128(15) }],
        max_trade_usd: U128(1000 * USD),
        allow_near: true,
        allow_usdc: true,
        allow_tokens: true,
        allow_trade: true,
        allow_only: None,
        blocked: vec![eve()],
        raise_delay_sec: 86_400,
    }
}

struct Ctx { ts: u64, pk: PublicKey, pred: AccountId, results: Option<bool>, gas: u64, balance: NearToken }
impl Ctx {
    fn new() -> Self { Ctx { ts: T0, pk: device_pk(), pred: me(), results: None, gas: 300, balance: NearToken::from_near(5) } }
    fn apply(&self) {
        let mut b = VMContextBuilder::new();
        b.current_account_id(me())
            .signer_account_id(if self.pred == me() { me() } else { self.pred.clone() })
            .signer_account_pk(self.pk.clone())
            .predecessor_account_id(self.pred.clone())
            .block_timestamp(self.ts)
            .prepaid_gas(Gas::from_tgas(self.gas))
            .account_balance(self.balance);
        testing_env!(b.build(), near_sdk::test_vm_config(), near_sdk::RuntimeFeesConfig::test(), Default::default(), match self.results { None => vec![], Some(true) => vec![PromiseResult::Successful(vec![])], Some(false) => vec![PromiseResult::Failed] });
    }
}

fn setup() -> (Wallet, Ctx) {
    let mut c = Ctx::new();
    c.pred = root();
    c.apply();
    let w = Wallet::new(vec![owner_pk()], "verifier.pocket.testnet".parse().unwrap(), "usdc.testnet".parse().unwrap(),
        "maker.pocket.testnet".parse().unwrap(), vec![PUSD.into()], limits());
    c.pred = me();
    c.apply();
    (w, c)
}

// ---------- setup ----------
#[test]
#[should_panic(expected = "Only this account or its parent")]
fn init_by_stranger_is_refused() {
    let mut c = Ctx::new();
    c.pred = eve();
    c.apply();
    Wallet::new(vec![owner_pk()], bob(), bob(), bob(), vec![], limits());
}

#[test]
#[should_panic(expected = "One to four owner keys")]
fn init_needs_an_owner_key() {
    let mut c = Ctx::new();
    c.pred = root();
    c.apply();
    Wallet::new(vec![], bob(), bob(), bob(), vec![], limits());
}

// ---------- caps ----------
#[test]
fn send_within_caps_is_counted() {
    let (mut w, _c) = setup();
    w.send_token(PUSD.into(), bob(), U128(60 * USD), None);
    w.send_usdc(bob(), U128(40 * USD), None);
    assert_eq!(w.get_spent().usd.0, 100 * USD, "pUSD and USDC share one dollar bucket");
}

#[test]
#[should_panic(expected = "Over your per send limit for dollars")]
fn over_per_send_is_refused() {
    let (mut w, _c) = setup();
    w.send_token(PUSD.into(), bob(), U128(100 * USD + 1), None);
}

#[test]
#[should_panic(expected = "Over your 24 hour limit for dollars")]
fn over_daily_is_refused() {
    let (mut w, _c) = setup();
    w.send_token(PUSD.into(), bob(), U128(100 * USD), None);
    w.send_usdc(bob(), U128(100 * USD), None);
    w.send_token(PUSD.into(), bob(), U128(1), None);
}

#[test]
fn refused_send_changes_nothing() {
    let (mut w, _c) = setup();
    w.send_token(PUSD.into(), bob(), U128(50 * USD), None);
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { w.send_token(PUSD.into(), bob(), U128(150 * USD), None); }));
    assert!(r.is_err());
    assert_eq!(w.get_spent().usd.0, 50 * USD);
}

#[test]
fn rolling_window_frees_up_after_24_hours_not_before() {
    let (mut w, mut c) = setup();
    w.send_token(PUSD.into(), bob(), U128(100 * USD), None);
    w.send_token(PUSD.into(), bob(), U128(100 * USD), None);
    c.ts = T0 + 23 * HOUR;
    c.apply();
    assert_eq!(w.get_spent().usd.0, 200 * USD, "still inside the 24 hour window");
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { w.send_token(PUSD.into(), bob(), U128(1), None); }));
    assert!(r.is_err(), "send 23 hours later must still be refused");
    c.ts = T0 + 24 * HOUR;
    c.apply();
    assert_eq!(w.get_spent().usd.0, 0);
    w.send_token(PUSD.into(), bob(), U128(100 * USD), None);
}

#[test]
fn near_caps_and_token_caps_are_separate() {
    let (mut w, _c) = setup();
    w.send_near(bob(), U128(NearToken::from_near(1).as_yoctonear()));
    w.send_token(TSLA.into(), bob(), U128(10), None);
    let s = w.get_spent();
    assert_eq!(s.near.0, NearToken::from_near(1).as_yoctonear());
    assert_eq!(s.usd.0, 0);
    assert_eq!(s.tokens, vec![(TSLA.to_string(), U128(10))]);
}

#[test]
#[should_panic(expected = "Over your 24 hour limit for nep141:tslaon")]
fn token_daily_cap() {
    let (mut w, _c) = setup();
    w.send_token(TSLA.into(), bob(), U128(10), None);
    w.send_token(TSLA.into(), bob(), U128(6), None);
}

#[test]
#[should_panic(expected = "has no limit set")]
fn token_without_cap_cannot_be_sent() {
    let (mut w, _c) = setup();
    w.send_token("nep141:other.testnet".into(), bob(), U128(1), None);
}

#[test]
#[should_panic(expected = "Over your per send limit for NEAR")]
fn near_per_send() {
    let (mut w, _c) = setup();
    w.send_near(bob(), U128(NearToken::from_near(1).as_yoctonear() + 1));
}

#[test]
#[should_panic(expected = "Not enough NEAR left")]
fn near_send_keeps_storage_and_reserve() {
    let (mut w, mut c) = setup();
    c.balance = NearToken::from_millinear(500);
    c.apply();
    w.send_near(bob(), U128(NearToken::from_millinear(499).as_yoctonear()));
}

#[test]
#[should_panic(expected = "Amount must be above zero")]
fn zero_amount_refused() {
    let (mut w, _c) = setup();
    w.send_usdc(bob(), U128(0), None);
}

#[test]
#[should_panic(expected = "Over your per send limit")]
fn huge_amount_refused_without_overflow() {
    let (mut w, _c) = setup();
    w.send_usdc(bob(), U128(u128::MAX), None);
}

// ---------- who may call ----------
#[test]
#[should_panic(expected = "Only this account's own keys")]
fn another_account_cannot_spend() {
    let (mut w, mut c) = setup();
    c.pred = eve();
    c.apply();
    w.send_usdc(bob(), U128(USD), None);
}

#[test]
#[should_panic(expected = "Attach more gas")]
fn low_gas_refused() {
    let (mut w, mut c) = setup();
    c.gas = 20;
    c.apply();
    w.send_usdc(bob(), U128(USD), None);
}

// ---------- receivers and kinds ----------
#[test]
#[should_panic(expected = "blocked by your rules")]
fn blocked_receiver() {
    let (mut w, _c) = setup();
    w.send_usdc(eve(), U128(USD), None);
}

#[test]
#[should_panic(expected = "cannot send to yourself")]
fn send_to_self_refused() {
    let (mut w, _c) = setup();
    w.send_usdc(me(), U128(USD), None);
}

#[test]
#[should_panic(expected = "only allow sends to your saved list")]
fn allow_list_is_enforced() {
    let (mut w, _c) = setup();
    let mut l = limits();
    l.allow_only = Some(vec![bob()]);
    w.lower_limits(l);
    w.send_usdc(bob(), U128(USD), None);
    w.send_usdc("carol.testnet".parse().unwrap(), U128(USD), None);
}

#[test]
#[should_panic(expected = "NEAR sends are off")]
fn kind_switch_is_enforced() {
    let (mut w, _c) = setup();
    let mut l = limits();
    l.allow_near = false;
    w.lower_limits(l);
    w.send_near(bob(), U128(1));
}

#[test]
#[should_panic(expected = "Over your per trade limit")]
fn trade_cap() {
    let (mut w, _c) = setup();
    w.trade(PUSD.into(), U128(1000 * USD + 1), "{}".into());
}

#[test]
#[should_panic(expected = "Unknown token for a trade")]
fn trade_unknown_token() {
    let (mut w, _c) = setup();
    w.trade("nep141:other.testnet".into(), U128(1), "{}".into());
}

#[test]
fn trade_within_cap_does_not_use_send_limit() {
    let (mut w, _c) = setup();
    w.trade(PUSD.into(), U128(1000 * USD), "{}".into());
    assert_eq!(w.get_spent().usd.0, 0);
}

// ---------- callbacks ----------
#[test]
fn failed_send_is_given_back() {
    let (mut w, mut c) = setup();
    w.send_token(PUSD.into(), bob(), U128(80 * USD), None);
    c.results = Some(false);
    c.apply();
    assert!(!w.on_sent("usd".into(), T0 / HOUR, U128(80 * USD)));
    assert_eq!(w.get_spent().usd.0, 0);
}

#[test]
fn successful_send_stays_counted() {
    let (mut w, mut c) = setup();
    w.send_token(PUSD.into(), bob(), U128(80 * USD), None);
    c.results = Some(true);
    c.apply();
    assert!(w.on_sent("usd".into(), T0 / HOUR, U128(80 * USD)));
    assert_eq!(w.get_spent().usd.0, 80 * USD);
}

#[test]
#[should_panic(expected = "Callback only")]
fn own_key_cannot_fake_a_callback() {
    let (mut w, _c) = setup();
    w.send_token(PUSD.into(), bob(), U128(80 * USD), None);
    w.on_sent("usd".into(), T0 / HOUR, U128(80 * USD));
}

#[test]
fn give_back_never_goes_below_zero() {
    let (mut w, mut c) = setup();
    w.send_token(PUSD.into(), bob(), U128(10 * USD), None);
    c.results = Some(false);
    c.apply();
    w.on_sent("usd".into(), T0 / HOUR, U128(500 * USD));
    assert_eq!(w.get_spent().usd.0, 0);
}

// ---------- changing the rules ----------
#[test]
fn device_can_lower_at_once() {
    let (mut w, _c) = setup();
    let mut l = limits();
    l.usd_per_day = U128(50 * USD);
    w.lower_limits(l.clone());
    assert_eq!(w.get_limits(), l);
}

#[test]
#[should_panic(expected = "That loosens a rule")]
fn device_cannot_raise_with_lower() {
    let (mut w, _c) = setup();
    let mut l = limits();
    l.usd_per_day = U128(201 * USD);
    w.lower_limits(l);
}

#[test]
#[should_panic(expected = "Only an owner key")]
fn device_cannot_propose() {
    let (mut w, _c) = setup();
    let mut l = limits();
    l.usd_per_day = U128(5000 * USD);
    w.propose_limits(l);
}

#[test]
#[should_panic(expected = "Only this account's own keys")]
fn stranger_cannot_propose_even_with_the_owner_public_key() {
    let (mut w, mut c) = setup();
    c.pred = eve();
    c.pk = owner_pk();
    c.apply();
    w.propose_limits(limits());
}

#[test]
fn owner_raise_waits_for_the_delay() {
    let (mut w, mut c) = setup();
    c.pk = owner_pk();
    c.apply();
    let mut l = limits();
    l.usd_per_day = U128(1000 * USD);
    w.propose_limits(l.clone());
    assert_eq!(w.get_limits().usd_per_day.0, 200 * USD, "not yet");
    assert!(w.get_pending().is_some());
    c.ts = T0 + 86_400 * 1_000_000_000 - 1;
    c.apply();
    assert_eq!(w.get_limits().usd_per_day.0, 200 * USD, "one nanosecond early");
    c.ts = T0 + 86_400 * 1_000_000_000;
    c.pk = device_pk();
    c.apply();
    assert_eq!(w.get_limits(), l);
    w.send_token(PUSD.into(), bob(), U128(100 * USD), None);
    w.send_token(PUSD.into(), bob(), U128(100 * USD), None);
    w.send_token(PUSD.into(), bob(), U128(100 * USD), None);
    assert_eq!(w.get_spent().usd.0, 300 * USD);
}

#[test]
fn owner_lowering_is_instant() {
    let (mut w, mut c) = setup();
    c.pk = owner_pk();
    c.apply();
    let mut l = limits();
    l.usd_per_send = U128(5 * USD);
    w.propose_limits(l.clone());
    assert_eq!(w.get_limits(), l);
}

#[test]
fn device_lowering_cancels_a_waiting_raise() {
    let (mut w, mut c) = setup();
    c.pk = owner_pk();
    c.apply();
    let mut up = limits();
    up.usd_per_day = U128(1000 * USD);
    w.propose_limits(up);
    c.pk = device_pk();
    c.apply();
    let mut down = limits();
    down.usd_per_day = U128(100 * USD);
    w.lower_limits(down.clone());
    c.ts = T0 + 2 * 86_400 * 1_000_000_000;
    c.apply();
    assert_eq!(w.get_limits(), down);
    assert!(w.get_pending().is_none());
}

#[test]
fn device_can_cancel_a_waiting_raise() {
    let (mut w, mut c) = setup();
    c.pk = owner_pk();
    c.apply();
    let mut up = limits();
    up.allow_only = None;
    up.blocked = vec![];
    w.propose_limits(up);
    c.pk = device_pk();
    c.apply();
    w.cancel_pending();
    c.ts = T0 + 2 * 86_400 * 1_000_000_000;
    c.apply();
    assert_eq!(w.get_limits(), limits());
}

#[test]
#[should_panic(expected = "Only an owner key")]
fn device_cannot_swap_owner_keys() {
    let (mut w, _c) = setup();
    w.set_owner_keys(vec![device_pk()]);
}

#[test]
fn is_raise_covers_every_rule() {
    let base = limits();
    let mut cases: Vec<Limits> = vec![];
    let mut l = base.clone(); l.usd_per_send = U128(l.usd_per_send.0 + 1); cases.push(l);
    let mut l = base.clone(); l.usd_per_day = U128(l.usd_per_day.0 + 1); cases.push(l);
    let mut l = base.clone(); l.near_per_send = U128(l.near_per_send.0 + 1); cases.push(l);
    let mut l = base.clone(); l.near_per_day = U128(l.near_per_day.0 + 1); cases.push(l);
    let mut l = base.clone(); l.max_trade_usd = U128(l.max_trade_usd.0 + 1); cases.push(l);
    let mut l = base.clone(); l.raise_delay_sec -= 1; cases.push(l);
    let mut l = base.clone(); l.blocked = vec![]; cases.push(l);
    let mut l = base.clone(); l.token_caps[0].per_day = U128(16); cases.push(l);
    let mut l = base.clone(); l.token_caps.push(TokenCap { token_id: "nep141:x".into(), per_send: U128(1), per_day: U128(1) }); cases.push(l);
    for c in &cases { assert!(is_raise(c, &base), "{:?}", c); }
    let mut off = base.clone(); off.allow_trade = false;
    assert!(!is_raise(&off, &base));
    assert!(is_raise(&base, &off), "turning a kind back on is a raise");
    let mut only = base.clone(); only.allow_only = Some(vec![bob()]);
    assert!(!is_raise(&only, &base));
    assert!(is_raise(&base, &only), "removing an allow list is a raise");
    let mut wider = only.clone(); wider.allow_only = Some(vec![bob(), eve()]);
    assert!(is_raise(&wider, &only), "adding to an allow list is a raise");
    let mut fewer = base.clone(); fewer.token_caps = vec![];
    assert!(!is_raise(&fewer, &base), "removing a token cap stops that token, so it is stricter");
    let mut more_blocked = base.clone(); more_blocked.blocked.push(bob());
    assert!(!is_raise(&more_blocked, &base));
    assert!(!is_raise(&base, &base));
}

#[test]
#[should_panic(expected = "Each token may have one cap")]
fn duplicate_token_caps_refused() {
    let (mut w, _c) = setup();
    let mut l = limits();
    l.token_caps.push(l.token_caps[0].clone());
    w.lower_limits(l);
}

#[test]
fn parallel_sends_never_pass_the_daily_cap() {
    // NEAR runs receipts for one account one after another, so "parallel" sends arrive in
    // some order. Whatever the order, the total that gets through is at most the cap.
    let (mut w, c) = setup();
    let mut ok = 0u128;
    for i in 0..50u128 {
        c.apply(); // fresh gas meter per call, like a new receipt
        let amt = (i % 7 + 1) * 9 * USD;
        let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { w.send_token(PUSD.into(), bob(), U128(amt), None); }));
        if r.is_ok() { ok += amt; }
    }
    assert!(ok <= 200 * USD);
    assert_eq!(w.get_spent().usd.0, ok);
}

#[test]
fn relayed_owner_call_is_guarded_by_the_access_key() {
    // In a NEP-366 meta transaction NEAR reports the relayer as signer. The device key cannot sign
    // such a delegate for propose_limits (its method list does not have it), so the chain refuses
    // it before this code runs; the contract accepts the call from its own account.
    let (mut w, _c) = setup();
    let mut b = VMContextBuilder::new();
    b.current_account_id(me()).signer_account_id("relayer.pocket.testnet".parse().unwrap()).signer_account_pk(device_pk())
        .predecessor_account_id(me()).block_timestamp(T0).prepaid_gas(Gas::from_tgas(300)).account_balance(NearToken::from_near(5));
    testing_env!(b.build());
    let mut l = limits();
    l.usd_per_day = U128(1000 * USD);
    w.propose_limits(l);
    assert!(w.get_pending().is_some(), "still waits for the delay");
}
