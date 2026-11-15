// Unit tests for the Pocket maker. Every bad trade message must end in a full refund.
use super::*;
use ed25519_dalek::{Signer, SigningKey};
use near_sdk::base64::Engine;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, PromiseResult};

const NOW_MS: u64 = 1_800_000_000_000;
fn maker() -> AccountId { "maker2.pocket.testnet".parse().unwrap() }
fn verifier() -> AccountId { "verifier.pocket.testnet".parse().unwrap() }
fn alice() -> AccountId { "alice.pocket.testnet".parse().unwrap() }
fn eve() -> AccountId { "eve.pocket.testnet".parse().unwrap() }
const PUSD: &str = "nep141:pusd.pocket.testnet";
const TSLA: &str = "nep141:tslaon.pocket.testnet";

fn key() -> SigningKey { SigningKey::from_bytes(&[7u8; 32]) }
fn pk_of(k: &SigningKey) -> PublicKey {
    let mut v = vec![0u8];
    v.extend_from_slice(k.verifying_key().as_bytes());
    PublicKey::try_from(v).unwrap()
}

fn ctx(pred: AccountId, results: Option<bool>) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(maker()).predecessor_account_id(pred).block_timestamp(NOW_MS * 1_000_000);
    let r = match results { None => vec![], Some(true) => vec![PromiseResult::Successful(vec![])], Some(false) => vec![PromiseResult::Failed] };
    testing_env!(b.build(), near_sdk::test_vm_config(), near_sdk::RuntimeFeesConfig::test(), Default::default(), r);
}

fn setup() -> Maker {
    ctx("pocket.testnet".parse().unwrap(), None);
    let m = Maker::new("pocket.testnet".parse().unwrap(), verifier(), pk_of(&key()));
    ctx(verifier(), None);
    m
}

fn quote(id: &str, account: &str, pay: u128, deadline: u64) -> String {
    format!(r#"{{"v":1,"maker":"{}","id":"{}","account":"{}","pay_token":"{}","pay_units":"{}","get_token":"{}","get_units":"5","deadline_ms":{}}}"#,
        maker(), id, account, PUSD, pay, TSLA, deadline)
}
fn msg_with(q: &str, k: &SigningKey) -> String {
    let sig = near_sdk::base64::engine::general_purpose::STANDARD.encode(k.sign(q.as_bytes()).to_bytes());
    near_sdk::serde_json::json!({ "quote": q, "signature": sig }).to_string()
}
fn call(m: &mut Maker, from: AccountId, amount: u128, msg: String) -> bool {
    // true = the maker pays (a promise), false = full refund
    match m.mt_on_transfer(from.clone(), vec![from], vec![PUSD.into()], vec![U128(amount)], msg) {
        PromiseOrValue::Promise(_) => true,
        PromiseOrValue::Value(v) => { assert_eq!(v, vec![U128(amount)]); false }
    }
}

#[test]
fn good_quote_pays_once() {
    let mut m = setup();
    let msg = msg_with(&quote("q1", "alice.pocket.testnet", 100, NOW_MS + 60_000), &key());
    assert!(call(&mut m, alice(), 100, msg.clone()));
    assert!(m.is_used("q1".into()));
    ctx(verifier(), None);
    assert!(!call(&mut m, alice(), 100, msg), "replayed quote is refunded");
}

#[test]
fn bad_signature_refunds() {
    let mut m = setup();
    let other = SigningKey::from_bytes(&[9u8; 32]);
    assert!(!call(&mut m, alice(), 100, msg_with(&quote("q1", "alice.pocket.testnet", 100, NOW_MS + 60_000), &other)));
    assert!(!m.is_used("q1".into()));
}

#[test]
fn edited_quote_refunds() {
    let mut m = setup();
    let q = quote("q1", "alice.pocket.testnet", 100, NOW_MS + 60_000);
    let good = msg_with(&q, &key());
    let tampered = good.replace("\\\"get_units\\\":\\\"5\\\"", "\\\"get_units\\\":\\\"500\\\"");
    assert_ne!(good, tampered);
    assert!(!call(&mut m, alice(), 100, tampered));
}

#[test]
fn another_payer_refunds() {
    let mut m = setup();
    assert!(!call(&mut m, eve(), 100, msg_with(&quote("q1", "alice.pocket.testnet", 100, NOW_MS + 60_000), &key())));
}

#[test]
fn wrong_amount_refunds() {
    let mut m = setup();
    assert!(!call(&mut m, alice(), 99, msg_with(&quote("q1", "alice.pocket.testnet", 100, NOW_MS + 60_000), &key())));
}

#[test]
fn expired_refunds() {
    let mut m = setup();
    assert!(!call(&mut m, alice(), 100, msg_with(&quote("q1", "alice.pocket.testnet", 100, NOW_MS - 1), &key())));
}

#[test]
fn garbage_refunds() {
    let mut m = setup();
    assert!(!call(&mut m, alice(), 100, "not json".into()));
}

#[test]
fn paused_refunds() {
    let mut m = setup();
    ctx("pocket.testnet".parse().unwrap(), None);
    m.set_paused(true);
    ctx(verifier(), None);
    assert!(!call(&mut m, alice(), 100, msg_with(&quote("q1", "alice.pocket.testnet", 100, NOW_MS + 60_000), &key())));
}

#[test]
#[should_panic(expected = "Only the verifier")]
fn only_verifier_can_call() {
    let mut m = setup();
    ctx(eve(), None);
    call(&mut m, alice(), 100, msg_with(&quote("q1", "alice.pocket.testnet", 100, NOW_MS + 60_000), &key()));
}

#[test]
fn failed_payment_refunds_in_full() {
    let mut m = setup();
    ctx(maker(), Some(false));
    assert_eq!(m.on_paid(U128(100)), vec![U128(100)]);
    ctx(maker(), Some(true));
    assert_eq!(m.on_paid(U128(100)), vec![U128(0)]);
}

#[test]
#[should_panic(expected = "Callback only")]
fn on_paid_cannot_be_called_directly() {
    let mut m = setup();
    ctx(maker(), None);
    m.on_paid(U128(100));
}

#[test]
#[should_panic(expected = "Owner only")]
fn stranger_cannot_withdraw() {
    let mut m = setup();
    ctx(eve(), None);
    m.withdraw(PUSD.into(), U128(1), eve());
}

#[test]
#[should_panic(expected = "Owner only")]
fn stranger_cannot_change_quote_key() {
    let mut m = setup();
    ctx(eve(), None);
    m.set_quote_key(pk_of(&SigningKey::from_bytes(&[9u8; 32])));
}
