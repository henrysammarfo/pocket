// Unit tests for the Pocket wallet rules. Each `#[should_panic]` test is a call the chain must
// refuse; a panic in a NEAR call means no state change and no money moved.
use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, NearToken, PromiseResult};
use ed25519_dalek::{Signer, SigningKey};

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

fn price_sk() -> SigningKey { SigningKey::from_bytes(&[5u8; 32]) }
fn owner_sk() -> SigningKey { SigningKey::from_bytes(&[6u8; 32]) }
fn pk_of(k: &SigningKey) -> PublicKey { let mut v = vec![0u8]; v.extend_from_slice(k.verifying_key().as_bytes()); PublicKey::try_from(v).unwrap() }
fn b64e(b: &[u8]) -> String { b.iter().map(|x| format!("{:02x}", x)).collect() }
fn sign_with(k: &SigningKey, tag: &[u8], msg: &str) -> String { let mut m = tag.to_vec(); m.extend_from_slice(msg.as_bytes()); b64e(&k.sign(&m).to_bytes()) }
/// A price signed by the test price key, valid for five minutes from `now_ms`.
fn price_at(token: &str, micro_usd: u128, decimals: u8, now_ms: u64) -> Option<SignedPrice> {
    let payload = format!(r#"{{"v":1,"token":"{}","micro_usd":"{}","decimals":{},"expires_ms":{}}}"#, token, micro_usd, decimals, now_ms + 300_000);
    Some(SignedPrice { signature: sign_with(&price_sk(), b"pocket.price.v1\n", &payload), payload })
}
fn near_px() -> Option<SignedPrice> { price_at("near", 3 * USD, 24, T0 / 1_000_000) }
fn tsla_px() -> Option<SignedPrice> { price_at(TSLA, 5 * USD, 0, T0 / 1_000_000) }

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
    let w = Wallet::new(vec![owner_pk(), pk_of(&owner_sk())], "verifier.pocket.testnet".parse().unwrap(), "usdc.testnet".parse().unwrap(),
        "maker.pocket.testnet".parse().unwrap(), vec![PUSD.into()], limits(), pk_of(&price_sk()));
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
    Wallet::new(vec![owner_pk()], bob(), bob(), bob(), vec![], limits(), pk_of(&price_sk()));
}

#[test]
#[should_panic(expected = "One to four owner keys")]
fn init_needs_an_owner_key() {
    let mut c = Ctx::new();
    c.pred = root();
    c.apply();
    Wallet::new(vec![], bob(), bob(), bob(), vec![], limits(), pk_of(&price_sk()));
}

// ---------- caps ----------
#[test]
fn send_within_caps_is_counted() {
    let (mut w, _c) = setup();
    w.send_token(PUSD.into(), bob(), U128(60 * USD), None, None);
    w.send_usdc(bob(), U128(40 * USD), None);
    assert_eq!(w.get_spent().usd.0, 100 * USD, "pUSD and USDC share one dollar bucket");
}

#[test]
#[should_panic(expected = "Over your per send limit for dollars")]
fn over_per_send_is_refused() {
    let (mut w, _c) = setup();
    w.send_token(PUSD.into(), bob(), U128(100 * USD + 1), None, None);
}

#[test]
#[should_panic(expected = "Over your 24 hour limit for dollars")]
fn over_daily_is_refused() {
    let (mut w, _c) = setup();
    w.send_token(PUSD.into(), bob(), U128(100 * USD), None, None);
    w.send_usdc(bob(), U128(100 * USD), None);
    w.send_token(PUSD.into(), bob(), U128(1), None, None);
}

#[test]
fn refused_send_changes_nothing() {
    let (mut w, _c) = setup();
    w.send_token(PUSD.into(), bob(), U128(50 * USD), None, None);
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { w.send_token(PUSD.into(), bob(), U128(150 * USD), None, None); }));
    assert!(r.is_err());
    assert_eq!(w.get_spent().usd.0, 50 * USD);
}

#[test]
fn rolling_window_frees_up_after_24_hours_not_before() {
    let (mut w, mut c) = setup();
    w.send_token(PUSD.into(), bob(), U128(100 * USD), None, None);
    w.send_token(PUSD.into(), bob(), U128(100 * USD), None, None);
    c.ts = T0 + 23 * HOUR;
    c.apply();
    assert_eq!(w.get_spent().usd.0, 200 * USD, "still inside the 24 hour window");
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { w.send_token(PUSD.into(), bob(), U128(1), None, None); }));
    assert!(r.is_err(), "send 23 hours later must still be refused");
    c.ts = T0 + 24 * HOUR;
    c.apply();
    assert_eq!(w.get_spent().usd.0, 0);
    w.send_token(PUSD.into(), bob(), U128(100 * USD), None, None);
}

#[test]
fn near_and_stock_sends_also_count_in_dollars() {
    let (mut w, _c) = setup();
    w.send_near(bob(), U128(NearToken::from_near(1).as_yoctonear()), near_px());
    w.send_token(TSLA.into(), bob(), U128(10), None, tsla_px());
    let s = w.get_spent();
    assert_eq!(s.near.0, NearToken::from_near(1).as_yoctonear());
    assert_eq!(s.usd.0, 53 * USD, "1 NEAR at $3 plus 10 TSLAon at $5 count as $53");
    assert_eq!(s.tokens, vec![(TSLA.to_string(), U128(10))]);
}

#[test]
#[should_panic(expected = "Over your 24 hour limit for nep141:tslaon")]
fn token_daily_cap() {
    let (mut w, _c) = setup();
    w.send_token(TSLA.into(), bob(), U128(10), None, tsla_px());
    w.send_token(TSLA.into(), bob(), U128(6), None, tsla_px());
}

#[test]
#[should_panic(expected = "has no limit set")]
fn token_without_cap_cannot_be_sent() {
    let (mut w, _c) = setup();
    w.send_token("nep141:other.testnet".into(), bob(), U128(1), None, None);
}

#[test]
#[should_panic(expected = "Over your per send limit for NEAR")]
fn near_per_send() {
    let (mut w, _c) = setup();
    w.send_near(bob(), U128(NearToken::from_near(1).as_yoctonear() + 1), near_px());
}

#[test]
#[should_panic(expected = "Not enough NEAR left")]
fn near_send_keeps_storage_and_reserve() {
    let (mut w, mut c) = setup();
    c.balance = NearToken::from_millinear(500);
    c.apply();
    w.send_near(bob(), U128(NearToken::from_millinear(499).as_yoctonear()), near_px());
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
    w.send_near(bob(), U128(1), near_px());
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
    w.send_token(PUSD.into(), bob(), U128(80 * USD), None, None);
    c.results = Some(false);
    c.apply();
    assert!(!w.on_sent("usd".into(), T0 / HOUR, U128(80 * USD), None));
    assert_eq!(w.get_spent().usd.0, 0);
}

#[test]
fn successful_send_stays_counted() {
    let (mut w, mut c) = setup();
    w.send_token(PUSD.into(), bob(), U128(80 * USD), None, None);
    c.results = Some(true);
    c.apply();
    assert!(w.on_sent("usd".into(), T0 / HOUR, U128(80 * USD), None));
    assert_eq!(w.get_spent().usd.0, 80 * USD);
}

#[test]
#[should_panic(expected = "Callback only")]
fn own_key_cannot_fake_a_callback() {
    let (mut w, _c) = setup();
    w.send_token(PUSD.into(), bob(), U128(80 * USD), None, None);
    w.on_sent("usd".into(), T0 / HOUR, U128(80 * USD), None);
}

#[test]
fn give_back_never_goes_below_zero() {
    let (mut w, mut c) = setup();
    w.send_token(PUSD.into(), bob(), U128(10 * USD), None, None);
    c.results = Some(false);
    c.apply();
    w.on_sent("usd".into(), T0 / HOUR, U128(500 * USD), None);
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
    w.send_token(PUSD.into(), bob(), U128(100 * USD), None, None);
    w.send_token(PUSD.into(), bob(), U128(100 * USD), None, None);
    w.send_token(PUSD.into(), bob(), U128(100 * USD), None, None);
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
        let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { w.send_token(PUSD.into(), bob(), U128(amt), None, None); }));
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

// ---------- model based checks: random sends over random hours against a simple reference ----------
// A small deterministic generator, so failures repeat exactly.
struct Lcg(u64);
impl Lcg { fn next(&mut self) -> u64 { self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407); self.0 >> 33 } }

fn model_run(seed: u64) {
    let (mut w, mut c) = setup();
    let mut r = Lcg(seed);
    let mut log: Vec<(u64, u128)> = vec![]; // (hour, amount) of sends that got through
    let mut hour = 0u64;
    for _ in 0..60 {
        hour += r.next() % 5; // 0 to 4 hours later
        c.ts = T0 + hour * HOUR;
        c.apply();
        let amt = (r.next() % 130 + 1) as u128 * USD; // 1 to 130 dollars, some over the per send cap
        let window: u128 = log.iter().filter(|(h, _)| hour < h + 24).map(|(_, a)| *a).sum();
        let want_ok = amt <= 100 * USD && window + amt <= 200 * USD;
        let got = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { w.send_token(PUSD.into(), bob(), U128(amt), None, None); })).is_ok();
        assert_eq!(got, want_ok, "seed {seed} hour {hour} amount {amt} window {window}");
        if got { log.push((hour, amt)); }
        let window_after: u128 = log.iter().filter(|(h, _)| hour < h + 24).map(|(_, a)| *a).sum();
        assert_eq!(w.get_spent().usd.0, window_after, "seed {seed}: spent matches the model");
        assert!(window_after <= 200 * USD, "seed {seed}: never over the daily cap");
    }
}
#[test] fn model_seed_1() { model_run(1); }
#[test] fn model_seed_2() { model_run(2); }
#[test] fn model_seed_3() { model_run(3); }
#[test] fn model_seed_4() { model_run(4); }
#[test] fn model_seed_5() { model_run(5); }
#[test] fn model_seed_6() { model_run(6); }
#[test] fn model_seed_7() { model_run(7); }
#[test] fn model_seed_8() { model_run(8); }
#[test] fn model_many_seeds() { for s in 100..140 { model_run(s); } }

#[test]
fn model_failed_sends_are_given_back_in_any_order() {
    // Reserve several sends, then fail some of the callbacks; the window must equal the successes.
    let (mut w, mut c) = setup();
    let mut r = Lcg(99);
    let mut keep = 0u128;
    for _ in 0..20 {
        c.results = None; c.apply();
        let amt = (r.next() % 9 + 1) as u128 * USD;
        if std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { w.send_token(PUSD.into(), bob(), U128(amt), None, None); })).is_err() { continue; }
        let ok = r.next() % 2 == 0;
        c.results = Some(ok); c.apply();
        w.on_sent("usd".into(), (T0 / 1_000_000_000) / 3600, U128(amt), None);
        if ok { keep += amt; }
    }
    c.results = None; c.apply();
    assert_eq!(w.get_spent().usd.0, keep);
}

#[test]
fn model_lowering_never_lets_more_through() {
    for s in 0..20u64 {
        let (mut w, c) = setup();
        let mut r = Lcg(s);
        let mut l = limits();
        l.usd_per_day = U128((r.next() % 200) as u128 * USD);
        l.usd_per_send = U128(((r.next() % 100) as u128).min(l.usd_per_day.0 / USD) * USD);
        w.lower_limits(l.clone());
        let mut total = 0u128;
        for _ in 0..30 {
            c.apply();
            let amt = (r.next() % 60 + 1) as u128 * USD;
            if std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| { w.send_token(PUSD.into(), bob(), U128(amt), None, None); })).is_ok() {
                assert!(amt <= l.usd_per_send.0); total += amt;
            }
        }
        assert!(total <= l.usd_per_day.0, "seed {s}");
    }
}

// ---------- version 2: signed prices ----------
fn try_send<F: FnOnce()>(f: F) -> bool { std::panic::catch_unwind(std::panic::AssertUnwindSafe(f)).is_ok() }

#[test]
#[should_panic(expected = "needs a current price")]
fn near_send_without_price_is_refused() {
    let (mut w, _c) = setup();
    w.send_near(bob(), U128(1), None);
}

#[test]
#[should_panic(expected = "not signed by Pocket")]
fn price_signed_by_someone_else_is_refused() {
    let (mut w, _c) = setup();
    let payload = format!(r#"{{"v":1,"token":"near","micro_usd":"1","decimals":24,"expires_ms":{}}}"#, T0 / 1_000_000 + 1000);
    let p = Some(SignedPrice { signature: sign_with(&owner_sk(), b"pocket.price.v1\n", &payload), payload });
    w.send_near(bob(), U128(NearToken::from_near(1).as_yoctonear()), p);
}

#[test]
#[should_panic(expected = "not signed by Pocket")]
fn edited_price_is_refused() {
    let (mut w, _c) = setup();
    let mut p = near_px().unwrap();
    p.payload = p.payload.replace("3000000", "1");
    w.send_near(bob(), U128(NearToken::from_near(1).as_yoctonear()), Some(p));
}

#[test]
#[should_panic(expected = "another token")]
fn price_for_another_token_is_refused() {
    let (mut w, _c) = setup();
    w.send_near(bob(), U128(1), tsla_px());
}

#[test]
#[should_panic(expected = "too old")]
fn stale_price_is_refused() {
    let (mut w, mut c) = setup();
    let p = near_px();
    c.ts = T0 + 6 * 60 * 1_000_000_000; // six minutes later, the price expired after five
    c.apply();
    w.send_near(bob(), U128(1), p);
}

#[test]
#[should_panic(expected = "too old")]
fn price_valid_too_far_ahead_is_refused() {
    let (mut w, _c) = setup();
    let p = price_at("near", 3 * USD, 24, T0 / 1_000_000 + 3_600_000);
    w.send_near(bob(), U128(1), p);
}

#[test]
#[should_panic(expected = "price is not signed")]
fn price_with_a_tag_from_owner_messages_is_refused() {
    let (mut w, _c) = setup();
    let payload = format!(r#"{{"v":1,"token":"near","micro_usd":"1","decimals":24,"expires_ms":{}}}"#, T0 / 1_000_000 + 1000);
    let p = Some(SignedPrice { signature: sign_with(&price_sk(), b"pocket.wallet.owner.v1\n", &payload), payload });
    w.send_near(bob(), U128(1), p);
}

#[test]
fn dollar_cap_binds_near_sends() {
    // $100 per send: 34 NEAR at $3 is $102. Raise the NEAR caps out of the way first.
    let (mut w, mut c) = setup();
    w.limits.near_per_send = U128(NearToken::from_near(100).as_yoctonear());
    w.limits.near_per_day = U128(NearToken::from_near(100).as_yoctonear());
    c.balance = NearToken::from_near(500); c.apply();
    assert!(!try_send(|| { w.send_near(bob(), U128(NearToken::from_near(34).as_yoctonear()), near_px()); }), "$102 in NEAR is over the $100 per send cap");
    assert!(try_send(|| { w.send_near(bob(), U128(NearToken::from_near(33).as_yoctonear()), near_px()); }));
    assert!(try_send(|| { w.send_near(bob(), U128(NearToken::from_near(33).as_yoctonear()), near_px()); }));
    assert!(!try_send(|| { w.send_near(bob(), U128(NearToken::from_near(2).as_yoctonear()), near_px()); }), "$198 + $6 is over the $200 day");
    assert_eq!(w.get_spent().usd.0, 198 * USD);
}

#[test]
fn failed_near_send_gives_back_dollars_too() {
    let (mut w, mut c) = setup();
    w.send_near(bob(), U128(NearToken::from_near(1).as_yoctonear()), near_px());
    c.results = Some(false); c.apply();
    assert!(!w.on_sent("near".into(), T0 / HOUR, U128(NearToken::from_near(1).as_yoctonear()), Some(U128(3 * USD))));
    c.results = None; c.apply();
    let s = w.get_spent();
    assert_eq!((s.near.0, s.usd.0), (0, 0));
}

#[test]
fn dollar_sends_need_no_price() {
    let (mut w, _c) = setup();
    w.send_token(PUSD.into(), bob(), U128(5 * USD), None, None);
    assert_eq!(w.get_spent().usd.0, 5 * USD);
}

// ---------- version 2: owner messages ----------
fn owner_msg(nonce: u64, action: &str) -> (String, PublicKey, String) {
    let payload = format!(r#"{{"account":"{}","nonce":{},"action":{}}}"#, me(), nonce, action);
    let sig = sign_with(&owner_sk(), b"pocket.wallet.owner.v1\n", &payload);
    (payload, pk_of(&owner_sk()), sig)
}
fn limits_json(l: &Limits) -> String { near_sdk::serde_json::to_string(l).unwrap() }

#[test]
fn owner_message_through_a_relayer_is_accepted() {
    // The relayer submits it: predecessor and signer are the relayer. The signature is what counts.
    let (mut w, mut c) = setup();
    c.pred = "relayer.pocket.testnet".parse().unwrap(); c.apply();
    let mut l = limits(); l.usd_per_send = U128(10 * USD);
    let (p, k, s) = owner_msg(1, &format!(r#"{{"set_limits":{{"limits":{}}}}}"#, limits_json(&l)));
    w.owner_action(p, k, s);
    assert_eq!(w.get_limits().usd_per_send.0, 10 * USD, "lowering applies at once");
    assert_eq!(w.get_config().owner_nonce, 1);
}

#[test]
fn owner_raise_by_message_waits_and_phone_can_cancel() {
    let (mut w, mut c) = setup();
    let mut l = limits(); l.usd_per_day = U128(900 * USD);
    let (p, k, s) = owner_msg(1, &format!(r#"{{"set_limits":{{"limits":{}}}}}"#, limits_json(&l)));
    w.owner_action(p, k, s);
    assert_eq!(w.get_limits().usd_per_day.0, 200 * USD);
    assert!(w.get_pending().is_some());
    w.cancel_pending();
    c.ts = T0 + 25 * HOUR; c.apply();
    assert_eq!(w.get_limits().usd_per_day.0, 200 * USD, "cancelled raise never applies");
}

#[test]
#[should_panic(expected = "Old or out of order")]
fn owner_message_cannot_be_replayed() {
    let (mut w, _c) = setup();
    let (p, k, s) = owner_msg(1, r#""cancel_pending""#);
    let _ = try_send(|| {});
    w.pending = Some(Pending { limits: limits(), effective_at_ns: T0 + HOUR, owner_keys: None });
    w.owner_action(p.clone(), k.clone(), s.clone());
    w.owner_action(p, k, s);
}

#[test]
#[should_panic(expected = "Old or out of order")]
fn owner_message_must_use_the_next_nonce() {
    let (mut w, _c) = setup();
    let (p, k, s) = owner_msg(5, r#""cancel_pending""#);
    w.owner_action(p, k, s);
}

#[test]
#[should_panic(expected = "Bad owner signature")]
fn edited_owner_message_is_refused() {
    let (mut w, _c) = setup();
    let (p, k, s) = owner_msg(1, r#""cancel_pending""#);
    w.owner_action(p.replace("cancel_pending", "cancel_pendinq"), k, s);
}

#[test]
#[should_panic(expected = "not an owner key")]
fn message_signed_by_a_non_owner_is_refused() {
    let (mut w, _c) = setup();
    let payload = format!(r#"{{"account":"{}","nonce":1,"action":"cancel_pending"}}"#, me());
    let sig = sign_with(&price_sk(), b"pocket.wallet.owner.v1\n", &payload);
    w.owner_action(payload, pk_of(&price_sk()), sig);
}

#[test]
#[should_panic(expected = "for another account")]
fn owner_message_for_another_account_is_refused() {
    let (mut w, _c) = setup();
    let payload = r#"{"account":"bob.testnet","nonce":1,"action":"cancel_pending"}"#.to_string();
    let sig = sign_with(&owner_sk(), b"pocket.wallet.owner.v1\n", &payload);
    w.owner_action(payload, pk_of(&owner_sk()), sig);
}

#[test]
#[should_panic(expected = "Bad owner signature")]
fn price_signature_cannot_be_used_as_owner_message() {
    let (mut w, _c) = setup();
    let payload = format!(r#"{{"account":"{}","nonce":1,"action":"cancel_pending"}}"#, me());
    let sig = sign_with(&owner_sk(), b"pocket.price.v1\n", &payload);
    w.owner_action(payload, pk_of(&owner_sk()), sig);
}

#[test]
fn owner_key_change_waits_a_day_and_the_phone_can_stop_it() {
    // A stolen recovery key tries to lock the real owner out.
    let (mut w, mut c) = setup();
    let thief = SigningKey::from_bytes(&[9u8; 32]);
    let (p, k, s) = owner_msg(1, &format!(r#"{{"set_owner_keys":{{"owner_keys":["{}"]}}}}"#, String::from(&pk_of(&thief))));
    w.owner_action(p, k, s);
    assert!(w.get_config().owner_keys.contains(&pk_of(&owner_sk())), "not yet replaced");
    c.ts = T0 + 23 * HOUR; c.apply();
    w.cancel_pending();
    c.ts = T0 + 48 * HOUR; c.apply();
    assert!(w.get_config().owner_keys.contains(&pk_of(&owner_sk())), "the phone stopped it");
}

#[test]
fn owner_key_change_applies_after_the_delay() {
    let (mut w, mut c) = setup();
    let guardian = SigningKey::from_bytes(&[11u8; 32]);
    let (p, k, s) = owner_msg(1, &format!(r#"{{"set_owner_keys":{{"owner_keys":["{}","{}"]}}}}"#, String::from(&pk_of(&owner_sk())), String::from(&pk_of(&guardian))));
    w.owner_action(p, k, s);
    c.ts = T0 + 24 * HOUR; c.apply();
    w.send_token(PUSD.into(), bob(), U128(1), None, None); // any call settles it
    assert!(w.get_config().owner_keys.contains(&pk_of(&guardian)));
}

#[test]
#[should_panic(expected = "One to four owner keys")]
fn owner_keys_cannot_be_emptied() {
    let (mut w, _c) = setup();
    let (p, k, s) = owner_msg(1, r#"{"set_owner_keys":{"owner_keys":[]}}"#);
    w.owner_action(p, k, s);
}

#[test]
fn owner_can_add_and_remove_phone_keys_at_once() {
    let (mut w, _c) = setup();
    let phone = String::from(&pk_of(&SigningKey::from_bytes(&[12u8; 32])));
    let (p, k, s) = owner_msg(1, &format!(r#"{{"add_device_key":{{"public_key":"{}"}}}}"#, phone));
    w.owner_action(p, k, s);
    let (p, k, s) = owner_msg(2, &format!(r#"{{"remove_key":{{"public_key":"{}"}}}}"#, phone));
    w.owner_action(p, k, s);
    assert_eq!(w.get_config().owner_nonce, 2);
}

#[test]
fn many_random_owner_messages_only_the_next_nonce_works() {
    let (mut w, _c) = setup();
    let mut r = Lcg(7);
    let mut want = 1u64;
    for _ in 0..40 {
        let n = want + (r.next() % 3) as u64; // sometimes skips ahead
        let (p, k, s) = owner_msg(n, r#"{"set_limits":{"limits":LIM}}"#.replace("LIM", &limits_json(&limits())).as_str());
        let ok = try_send(|| w.owner_action(p, k, s));
        assert_eq!(ok, n == want, "nonce {n} want {want}");
        if ok { want += 1; }
    }
}

// The browser (noble ed25519, src/lib/shared/wallet.ts) and this contract sign the same bytes:
// these vectors were produced by signTagged in TypeScript with the same seeds.
#[test]
fn signatures_match_the_typescript_signer() {
    let p = r#"{"account":"alice.pocket.testnet","nonce":1,"action":{"set_limits":{"limits":{"x":1}}}}"#;
    assert_eq!(sign_with(&owner_sk(), b"pocket.wallet.owner.v1\n", p), "071271910161098ae42ab24f6108c16e3541d970bb2463b8335269de1c7c41c2b97206e99046e8ad2103edd52d49ca7f98a01dc890eb1957517aaf95712dde06");
    let q = r#"{"v":1,"token":"near","micro_usd":"3000000","decimals":24,"expires_ms":99}"#;
    assert_eq!(sign_with(&price_sk(), b"pocket.price.v1\n", q), "b92bda70d301fa8104cfbbe7328ea1809cf178d459436b80eb293bf81f1ade370a6b2356ab62d61dc4c60e20e7c7ef8579c4d5c1261131c86291d87792c6800d");
}
