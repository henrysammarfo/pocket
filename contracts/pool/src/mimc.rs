//! MiMCSponge over the BN254 scalar field, the same hash circomlib's `MiMCSponge(n, 220, 1)` computes.
//!
//! Adapted from hideyour-cash/hideyour-cash packages/contract-libraries/near_mimc (src/lib.rs, src/fp.rs and
//! src/round_constants.rs) at commit 6f27e38ec543bc392c00c9201c19f783a485b655, MIT. Changes: near_bigint's U256
//! is replaced by the `uint` crate's U256, and the unused account hash helpers are dropped. The round constants
//! file is copied unchanged. The unit tests check outputs against circomlibjs.
use ff_wasm_unknown_unknown::{Field, PrimeField};

use crate::U256;

#[derive(PrimeField)]
#[PrimeFieldModulus = "21888242871839275222246405745257275088548364400416034343698204186575808495617"]
#[PrimeFieldGenerator = "7"]
#[PrimeFieldReprEndianness = "little"]
pub struct Fp([u64; 4]);

impl Fp {
    pub const fn dangerous_new(limbs: [u64; 4]) -> Self {
        Self(limbs)
    }
}

fn to_fp(v: U256) -> Fp {
    let mut b = [0u8; 32];
    v.to_little_endian(&mut b);
    Option::from(Fp::from_repr(FpRepr(b))).unwrap_or_else(|| near_sdk::env::panic_str("Value is not in the field."))
}

fn from_fp(v: Fp) -> U256 {
    U256::from_little_endian(&v.to_repr().0)
}

fn feistel(k: Fp, left: Fp, right: Fp) -> (Fp, Fp) {
    let (mut l, mut r) = (left, right);
    for &c in crate::mimc_constants::ROUND_CONSTANTS.iter() {
        let t = k + l + c;
        let t2 = t * t;
        let t5 = t2 * t2 * t;
        (l, r) = (r + t5, l);
    }
    (r, l)
}

/// MiMCSponge with key 0 and one output, for one or more inputs.
pub fn sponge(inputs: &[U256]) -> U256 {
    let k = Fp::zero();
    let mut h = (Fp::zero(), Fp::zero());
    for &x in inputs {
        h = feistel(k, h.0 + to_fp(x), h.1);
    }
    from_fp(h.0)
}
