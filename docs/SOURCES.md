# Sources

Every external document and repository the private pool (branch `private-pool`) relies on, and what was taken from each. Code that was copied or adapted names its source and commit in the file header too.

## Code adapted or copied

| What | Source, pinned | Licence | Where in this repo | Changes |
| --- | --- | --- | --- | --- |
| Withdraw circuit (Merkle membership and nullifier, tornado-core design) | [hideyour-cash/hideyour-cash `packages/circuits/circom/withdraw.circom` and `merkleTree.circom` at `6f27e38`](https://github.com/hideyour-cash/hideyour-cash/tree/6f27e38ec543bc392c00c9201c19f783a485b655/packages/circuits/circom) | MIT | `circuits/withdraw.circom`, `circuits/merkleTree.circom` | Allowlist tree and `originDepositor` removed, so the commitment is MiMCSponge(secret, nullifier). `merkleTree.circom` only has its include path changed. |
| Groth16 verifier on NEAR's alt_bn128 host functions (crate `near_groth16_verifier` 1.0.1) | [hideyour-cash `packages/contract-libraries/groth_verifier/near_groth16_verifier` at `6f27e38`](https://github.com/hideyour-cash/hideyour-cash/tree/6f27e38ec543bc392c00c9201c19f783a485b655/packages/contract-libraries/groth_verifier/near_groth16_verifier), [crates.io](https://crates.io/crates/near_groth16_verifier) | MIT | `contracts/pool/src/groth16.rs` | Raw `sys` calls replaced by near-sdk 5 `env::alt_bn128_*`; points parsed from snarkjs JSON. |
| MiMCSponge in Rust for wasm | [hideyour-cash `packages/contract-libraries/near_mimc` at `6f27e38`](https://github.com/hideyour-cash/hideyour-cash/tree/6f27e38ec543bc392c00c9201c19f783a485b655/packages/contract-libraries/near_mimc) | MIT | `contracts/pool/src/mimc.rs`, `contracts/pool/src/mimc_constants.rs` | `uint` crate instead of `near_bigint`; round constants copied unchanged with their own tests. |
| Prime field arithmetic (`ff` for wasm32) | [hideyour-cash `packages/contract-libraries/ff_wasm_unknown_unknown` at `6f27e38`](https://github.com/hideyour-cash/hideyour-cash/tree/6f27e38ec543bc392c00c9201c19f783a485b655/packages/contract-libraries/ff_wasm_unknown_unknown), itself from [zkcrypto/ff](https://github.com/zkcrypto/ff) | MIT or Apache 2.0 | `contracts/pool/vendor/ff_wasm_unknown_unknown` | Unchanged except its `rust-toolchain` file was removed. |
| Fixed size note pool design: commitment, nullifier hash, root history, empty leaf `keccak256("tornado") mod r`, recipient, relayer and fee bound into the proof | [tornadocash/tornado-core](https://github.com/tornadocash/tornado-core) (`circuits/withdraw.circom`, `contracts/MerkleTreeWithHistory.sol`) | MIT | `contracts/pool/src/lib.rs` | Ported to near-sdk 5; payouts that fail make the note spendable again. |

hideyour.cash was built by hack-a-chain for NEAR. Their Groth16 verifier was announced as the first ZK verifier deployed on NEAR ([iden3/snarkjs issue 303](https://github.com/iden3/snarkjs/issues/303), [Eduardogbg/chalice](https://github.com/Eduardogbg/chalice)). It has not had a public audit that we could find, and neither has this port. tornado-core's circuits were audited for Tornado Cash; our circuit is a small change of a derivative of them, so that audit does not carry over.

## Libraries used as is

| Library | Version | Used for |
| --- | --- | --- |
| [iden3/circom](https://github.com/iden3/circom) | 2.1.9 release binary | Compiling the circuit |
| [iden3/snarkjs](https://github.com/iden3/snarkjs) | 0.7.5 | Groth16 setup, proving in the browser and in tests |
| [iden3/circomlib](https://github.com/iden3/circomlib) | 2.0.5 | `MiMCSponge`, `bitify` circuits |
| [iden3/circomlibjs](https://github.com/iden3/circomlibjs) | 0.1.7 | MiMCSponge in the browser (`src/lib/shared/zkpool.ts`) |
| [near/near-sdk-rs](https://github.com/near/near-sdk-rs) | 5.15 | Contracts, `env::alt_bn128_g1_sum`, `env::alt_bn128_g1_multiexp`, `env::alt_bn128_pairing_check` |
| [paritytech/parity-common `uint`](https://github.com/paritytech/parity-common) | 0.9 | 256 bit integers in the pool contract |
| [@noble/hashes](https://github.com/paulmillr/noble-hashes) | as in package-lock | sha256 for the account field |

## Trusted setup inputs

| Input | Source | Check |
| --- | --- | --- |
| Phase 1 powers of tau, 2^15 | [PSE Perpetual Powers of Tau, `ppot_0080_15.ptau`](https://pse-trusted-setup-ppot.s3.eu-central-1.amazonaws.com/pot28_0080/ppot_0080_15.ptau) ([ceremony](https://github.com/privacy-scaling-explorations/perpetualpowersoftau)) | sha256 `4a8eb5a754ed4710d6ad603c2e1a89c72325a448e4474f8694d2c71c7c272f3d` |
| Phase 2 (circuit specific) | One contribution by this project on 15 Nov 2026, then a snarkjs beacon | `npx snarkjs zkey verify` against the r1cs and the ptau above (see docs/TEST_REPORT.pool.md). A single party phase 2 means whoever ran it could forge proofs if they kept the toxic waste; we did not keep it, but you have to trust that. Fine for testnet, not for real money. |

## NEAR documentation

| Doc | Used for |
| --- | --- |
| [NEAR host functions for alt_bn128 (NEP-98 precompiles), near-sdk `env` docs](https://docs.rs/near-sdk/latest/near_sdk/env/fn.alt_bn128_pairing_check.html) | Pairing check and G1 operations in the verifier |
| [Global contracts](https://docs.near.org/smart-contracts/global-contracts) | Why deploying wallet v3 for every signup costs about 22.5 testnet NEAR (ten times normal storage) |
| [Meta transactions (NEP-366)](https://docs.near.org/protocol/transactions/meta-tx) | `send_private` relayed gaslessly like the other wallet calls |
| [Access keys](https://docs.near.org/protocol/access-keys) | The phone key method list now includes `send_private` |
| [Testnet faucet](https://docs.near.org/getting-started/faucet) | Funding (the CLI faucet answered 429 all morning, see the report) |

## Prior NEAR privacy pools we looked at (not used)

[gourab337/near-privacy-rings](https://github.com/gourab337/near-privacy-rings), [ArhamKhan117/Hushd](https://github.com/ArhamKhan117/Hushd), [justtboreddev/clearpool](https://github.com/justtboreddev/clearpool). All are hackathon projects with their own single party setups. We built on hideyour.cash instead because its verifier and MiMC crates are published on crates.io, MIT licensed, and were the first ones used on NEAR.
