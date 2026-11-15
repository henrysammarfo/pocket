//! Unit tests with a real proof made by snarkjs (scripts/pool-vector.mts writes tests/vector.json).
use super::*;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::testing_env;
use serde_json::Value;

const DENOM: u128 = 100_000_000_000_000_000_000_000; // 0.1 NEAR

fn vector() -> Value {
    serde_json::from_str(include_str!("../tests/vector.json")).unwrap()
}

fn ctx(deposit: u128) {
    let mut b = VMContextBuilder::new();
    b.current_account_id("pool.testnet".parse().unwrap())
        .predecessor_account_id("relay.testnet".parse().unwrap())
        .attached_deposit(NearToken::from_yoctonear(deposit))
        .account_balance(NearToken::from_near(10))
        .prepaid_gas(Gas::from_tgas(300));
    testing_env!(b.build());
}

fn pool() -> (Pool, Value) {
    let v = vector();
    ctx(0);
    let vk: VerifyingKey = serde_json::from_value(v["vk"].clone()).unwrap();
    (Pool::new(U128(DENOM), vk), v)
}

fn filled() -> (Pool, Value) {
    let (mut p, v) = pool();
    ctx(DENOM);
    for c in v["commitments"].as_array().unwrap() {
        p.deposit(c.as_str().unwrap().to_string());
    }
    (p, v)
}

fn args(v: &Value) -> (Proof, String, String, AccountId, Option<AccountId>, U128) {
    let w = &v["withdraw"];
    (
        serde_json::from_value(w["proof"].clone()).unwrap(),
        w["root"].as_str().unwrap().into(),
        w["nullifier_hash"].as_str().unwrap().into(),
        w["recipient"].as_str().unwrap().parse().unwrap(),
        Some(w["relayer"].as_str().unwrap().parse().unwrap()),
        U128(w["fee"].as_str().unwrap().parse().unwrap()),
    )
}

#[test]
fn empty_root_matches_the_app() {
    let (p, v) = pool();
    assert_eq!(p.get_info().root, v["emptyRoot"].as_str().unwrap());
}

#[test]
fn roots_after_each_deposit_match_the_app() {
    let (mut p, v) = pool();
    ctx(DENOM);
    for (c, r) in v["commitments"].as_array().unwrap().iter().zip(v["roots"].as_array().unwrap()) {
        p.deposit(c.as_str().unwrap().to_string());
        assert_eq!(p.get_info().root, r.as_str().unwrap());
    }
    assert_eq!(p.get_leaves(0, 10).len(), 3);
}

#[test]
fn valid_proof_pays_once() {
    let (mut p, v) = filled();
    ctx(0);
    let (pr, r, n, to, rel, fee) = args(&v);
    p.withdraw(pr, r, n.clone(), to, rel, fee);
    assert!(p.is_spent(n));
}

#[test]
#[should_panic(expected = "That note was already spent.")]
fn double_spend_is_refused() {
    let (mut p, v) = filled();
    ctx(0);
    let (pr, r, n, to, rel, fee) = args(&v);
    p.withdraw(pr.clone(), r.clone(), n.clone(), to.clone(), rel.clone(), fee);
    p.withdraw(pr, r, n, to, rel, fee);
}

#[test]
#[should_panic(expected = "Invalid proof.")]
fn changing_the_recipient_breaks_the_proof() {
    let (mut p, v) = filled();
    ctx(0);
    let (pr, r, n, _, rel, fee) = args(&v);
    p.withdraw(pr, r, n, "thief.testnet".parse().unwrap(), rel, fee);
}

#[test]
#[should_panic(expected = "Invalid proof.")]
fn changing_the_fee_breaks_the_proof() {
    let (mut p, v) = filled();
    ctx(0);
    let (pr, r, n, to, rel, _) = args(&v);
    p.withdraw(pr, r, n, to, rel, U128(2000));
}

#[test]
#[should_panic(expected = "Invalid proof.")]
fn changing_the_relayer_breaks_the_proof() {
    let (mut p, v) = filled();
    ctx(0);
    let (pr, r, n, to, _, fee) = args(&v);
    p.withdraw(pr, r, n, to, Some("evil.testnet".parse().unwrap()), fee);
}

#[test]
#[should_panic(expected = "Invalid proof.")]
fn forged_nullifier_is_refused() {
    let (mut p, v) = filled();
    ctx(0);
    let (pr, r, _, to, rel, fee) = args(&v);
    p.withdraw(pr, r, "12345".into(), to, rel, fee);
}

#[test]
#[should_panic(expected = "Invalid proof.")]
fn forged_proof_is_refused() {
    let (mut p, v) = filled();
    ctx(0);
    let (mut pr, r, n, to, rel, fee) = args(&v);
    // Swap a and c: both are valid curve points, but the proof no longer holds.
    std::mem::swap(&mut pr.pi_a, &mut pr.pi_c);
    p.withdraw(pr, r, n, to, rel, fee);
}

#[test]
#[should_panic(expected = "Unknown or too old root.")]
fn unknown_root_is_refused() {
    let (mut p, v) = filled();
    ctx(0);
    let (pr, _, n, to, rel, fee) = args(&v);
    p.withdraw(pr, "1".into(), n, to, rel, fee);
}

#[test]
#[should_panic(expected = "Unknown or too old root.")]
fn proof_before_the_note_exists_is_refused() {
    let (mut p, v) = pool();
    ctx(DENOM);
    p.deposit(v["commitments"][0].as_str().unwrap().into());
    ctx(0);
    let (pr, r, n, to, rel, fee) = args(&v);
    p.withdraw(pr, r, n, to, rel, fee);
}

#[test]
#[should_panic(expected = "Attach exactly one note's amount.")]
fn wrong_deposit_amount_is_refused() {
    let (mut p, v) = pool();
    ctx(DENOM - 1);
    p.deposit(v["commitments"][0].as_str().unwrap().into());
}

#[test]
#[should_panic(expected = "That note was already deposited.")]
fn same_commitment_twice_is_refused() {
    let (mut p, v) = pool();
    ctx(DENOM);
    p.deposit(v["commitments"][0].as_str().unwrap().into());
    p.deposit(v["commitments"][0].as_str().unwrap().into());
}

#[test]
#[should_panic(expected = "commitment is not in the field.")]
fn commitment_outside_the_field_is_refused() {
    let (mut p, _) = pool();
    ctx(DENOM);
    p.deposit("21888242871839275222246405745257275088548364400416034343698204186575808495617".into());
}

#[test]
#[should_panic(expected = "Fee is too high.")]
fn fee_above_the_note_is_refused() {
    let (mut p, v) = filled();
    ctx(0);
    let (pr, r, n, to, rel, _) = args(&v);
    p.withdraw(pr, r, n, to, rel, U128(DENOM));
}

#[test]
fn failed_payout_frees_the_note() {
    let (mut p, v) = filled();
    ctx(0);
    let (pr, r, n, to, rel, fee) = args(&v);
    p.withdraw(pr, r, n.clone(), to, rel, fee);
    let mut b = VMContextBuilder::new();
    b.current_account_id("pool.testnet".parse().unwrap()).predecessor_account_id("pool.testnet".parse().unwrap());
    testing_env!(b.build());
    assert!(!p.on_payout(n.clone(), Err(PromiseError::Failed)));
    assert!(!p.is_spent(n));
}
