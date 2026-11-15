//! Groth16 verifier on NEAR's alt_bn128 host functions.
//!
//! Adapted from hideyour-cash/hideyour-cash packages/contract-libraries/groth_verifier/near_groth16_verifier
//! (src/lib.rs and src/pairing.rs, published as the `near_groth16_verifier` crate 1.0.1) at commit
//! 6f27e38ec543bc392c00c9201c19f783a485b655, MIT. Changes: the raw `sys` calls are replaced by near-sdk 5's
//! `env::alt_bn128_g1_sum`, `env::alt_bn128_g1_multiexp` and `env::alt_bn128_pairing_check`, the points are
//! built from snarkjs JSON (decimal strings), and malformed numbers give false (a point that is not on the curve makes the host function fail the call).
use near_sdk::env;
use near_sdk::near;

use crate::U256;

/// Base field modulus of BN254 (for negating a G1 point).
const Q: &str = "21888242871839275222246405745257275088696311157297823662689037894645226208583";
/// Scalar field modulus of BN254 (public inputs must be below it).
pub const R: &str = "21888242871839275222246405745257275088548364400416034343698204186575808495617";

fn le(v: &U256) -> [u8; 32] {
    let mut b = [0u8; 32];
    v.to_little_endian(&mut b);
    b
}

pub fn dec(s: &str) -> Option<U256> {
    if s.is_empty() || s.len() > 78 || !s.bytes().all(|c| c.is_ascii_digit()) {
        return None;
    }
    U256::from_dec_str(s).ok()
}

#[derive(Clone, Copy)]
pub struct G1 {
    pub x: U256,
    pub y: U256,
}

#[derive(Clone, Copy)]
pub struct G2 {
    pub x: [U256; 2],
    pub y: [U256; 2],
}

impl G1 {
    fn neg(&self) -> G1 {
        let q = U256::from_dec_str(Q).unwrap();
        if self.x.is_zero() && self.y.is_zero() {
            *self
        } else {
            G1 { x: self.x, y: q - (self.y % q) }
        }
    }
    fn add(a: &G1, b: &G1) -> G1 {
        let mut input = Vec::with_capacity(130);
        for p in [a, b] {
            input.push(0u8);
            input.extend_from_slice(&le(&p.x));
            input.extend_from_slice(&le(&p.y));
        }
        let out = env::alt_bn128_g1_sum(&input);
        G1 { x: U256::from_little_endian(&out[0..32]), y: U256::from_little_endian(&out[32..64]) }
    }
    fn mul(&self, s: U256) -> G1 {
        let mut input = Vec::with_capacity(96);
        input.extend_from_slice(&le(&self.x));
        input.extend_from_slice(&le(&self.y));
        input.extend_from_slice(&le(&s));
        let out = env::alt_bn128_g1_multiexp(&input);
        G1 { x: U256::from_little_endian(&out[0..32]), y: U256::from_little_endian(&out[32..64]) }
    }
}

/// A verification key as snarkjs exports it (decimal strings, projective with z = 1).
#[near(serializers = [borsh, json])]
#[derive(Clone)]
pub struct VerifyingKey {
    pub vk_alpha_1: Vec<String>,
    pub vk_beta_2: Vec<Vec<String>>,
    pub vk_gamma_2: Vec<Vec<String>>,
    pub vk_delta_2: Vec<Vec<String>>,
    #[serde(rename = "IC")]
    pub ic: Vec<Vec<String>>,
}

/// A proof as snarkjs prints it.
#[near(serializers = [json])]
#[derive(Clone)]
pub struct Proof {
    pub pi_a: Vec<String>,
    pub pi_b: Vec<Vec<String>>,
    pub pi_c: Vec<String>,
}

fn g1(v: &[String]) -> Option<G1> {
    Some(G1 { x: dec(v.first()?)?, y: dec(v.get(1)?)? })
}

fn g2(v: &[Vec<String>]) -> Option<G2> {
    let x = v.first()?;
    let y = v.get(1)?;
    Some(G2 { x: [dec(x.first()?)?, dec(x.get(1)?)?], y: [dec(y.first()?)?, dec(y.get(1)?)?] })
}

fn pairing(pairs: &[(G1, G2)]) -> bool {
    let mut bytes = Vec::with_capacity(pairs.len() * 192);
    for (a, b) in pairs {
        bytes.extend_from_slice(&le(&a.x));
        bytes.extend_from_slice(&le(&a.y));
        bytes.extend_from_slice(&le(&b.x[0]));
        bytes.extend_from_slice(&le(&b.x[1]));
        bytes.extend_from_slice(&le(&b.y[0]));
        bytes.extend_from_slice(&le(&b.y[1]));
    }
    env::alt_bn128_pairing_check(&bytes)
}

fn on_curve_coords(p: &G1, q: &U256) -> bool {
    p.x < *q && p.y < *q
}

/// True only for a valid proof of `inputs` under `vk`. Malformed numbers give false; a point off the curve fails the call.
pub fn verify(vk: &VerifyingKey, inputs: &[U256], proof: &Proof) -> bool {
    let q = U256::from_dec_str(Q).unwrap();
    let r = U256::from_dec_str(R).unwrap();
    if inputs.len() + 1 != vk.ic.len() || inputs.iter().any(|x| *x >= r) {
        return false;
    }
    let (Some(a), Some(b), Some(c)) = (g1(&proof.pi_a), g2(&proof.pi_b), g1(&proof.pi_c)) else { return false };
    if !on_curve_coords(&a, &q) || !on_curve_coords(&c, &q) || b.x.iter().chain(b.y.iter()).any(|v| *v >= q) {
        return false;
    }
    let (Some(alpha), Some(beta), Some(gamma), Some(delta)) =
        (g1(&vk.vk_alpha_1), g2(&vk.vk_beta_2), g2(&vk.vk_gamma_2), g2(&vk.vk_delta_2))
    else {
        return false;
    };
    let Some(mut acc) = g1(&vk.ic[0]) else { return false };
    for (i, x) in inputs.iter().enumerate() {
        let Some(p) = g1(&vk.ic[i + 1]) else { return false };
        if !x.is_zero() {
            acc = G1::add(&acc, &p.mul(*x));
        }
    }
    pairing(&[(a.neg(), b), (alpha, beta), (acc, gamma), (c, delta)])
}
