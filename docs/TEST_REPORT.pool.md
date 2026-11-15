# Private pool test report (branch `private-pool`)

All times Africa/Accra (UTC+0), 15 Nov 2026. Testnet only.

## Contracts

| Suite | Command | Result |
| --- | --- | --- |
| Pool contract, with a real snarkjs proof (`contracts/pool/tests/vector.json`, made by `npx tsx scripts/pool-vector.mts`) | `cd contracts/pool && cargo test` | **19 passed, 0 failed** (3 of them check the MiMC round constants against circomlib) |
| Wallet contract, including 8 new `send_private` tests | `cd contracts/wallet && cargo test` | **83 passed, 0 failed** |
| Market contract | `cd contracts/maker && cargo test` | 13 passed (unchanged) |

Pool tests by name: `empty_root_matches_the_app`, `roots_after_each_deposit_match_the_app`, `valid_proof_pays_once`, `double_spend_is_refused`, `changing_the_recipient_breaks_the_proof`, `changing_the_fee_breaks_the_proof`, `changing_the_relayer_breaks_the_proof`, `forged_nullifier_is_refused`, `forged_proof_is_refused`, `unknown_root_is_refused`, `proof_before_the_note_exists_is_refused`, `wrong_deposit_amount_is_refused`, `same_commitment_twice_is_refused`, `commitment_outside_the_field_is_refused`, `fee_above_the_note_is_refused`, `failed_payout_frees_the_note`.

Wallet `send_private` tests: `private_send_counts_against_near_and_dollar_caps`, `private_send_per_send_cap`, `private_send_daily_cap_shared_with_public_sends`, `private_send_needs_a_signed_price`, `private_send_by_a_stranger_is_refused`, `private_send_without_a_pool_is_refused`, `private_send_respects_the_allow_list`, `failed_pool_deposit_gives_the_cap_back`.

## TypeScript unit tests

`npm test`: **343 passed** (337 before this branch plus 6 in `tests/unit/private-pool.test.ts`: the browser builds the same Merkle roots as the contract, notes hash correctly, the account field, and the relayer policy for `send_private`).

## Testnet run 1: the pool on its own (`npx tsx scripts/pool-testnet.mts`, log in [pool-testnet.json](pool-testnet.json))

| Step | Result | Transaction |
| --- | --- | --- |
| deposit 0.1 NEAR note from `market.pocket-7e2413.testnet` | ok | [GoWrSmLw…](https://testnet.nearblocks.io/txns/GoWrSmLwCNSAZ9FaeT814v4pd7T4qd9wZ2PFEVdwt5pg) |
| deposit a second note | ok | [EV39AmU7…](https://testnet.nearblocks.io/txns/EV39AmU7j3nNNd6nXgjgBXtJvM2yAStKRXUS2hPtGpTF) |
| relayer withdraws one note to a brand new implicit account `738485a5…` | ok, 38 Tgas in the pool | [EtZX2gJG…](https://testnet.nearblocks.io/txns/EtZX2gJGhRweNXQ2zZ9QFQYpiRXCXB5pXCHsAW2sFy63) |
| attack: the same note again (double spend) | refused: "That note was already spent." | [4pRuESDg…](https://testnet.nearblocks.io/txns/4pRuESDgFN2zpUehAzAXBtgqnCXKMG1yfLroecwy1fYi) |
| attack: valid proof, recipient swapped to the relayer | refused: "Invalid proof." | [Cm2M13QH…](https://testnet.nearblocks.io/txns/Cm2M13QHXotyGM7fcjqPJTc2oWNSvgpaiQkdZbCgNTte) |
| attack: forged proof (a and c swapped) | refused: "Invalid proof." | [EE6JEmUh…](https://testnet.nearblocks.io/txns/EE6JEmUhtDNWGN5sg5FgWHwNbzX1gEekRsWqpEu1zCqH) |
| attack: unknown root | refused: "Unknown or too old root." | [6H4BFxRB…](https://testnet.nearblocks.io/txns/6H4BFxRBNcBpwYknWsrcRzfrnrS5sDe74MFXsRFAYmKF) |
| attack: relayer adds itself a fee the proof did not sign | refused: "Invalid proof." | [3ZiRa1UV…](https://testnet.nearblocks.io/txns/3ZiRa1UVr8DJQmuq4eKA544Pfs5peGbEuhYniYzGatAV) |

**8 of 8 as expected.**

## Testnet run 2: private sends through a wallet with on chain limits (`npx tsx scripts/pool-limits-testnet.mts`, log in [pool-limits-testnet.json](pool-limits-testnet.json))

Wallet `pdemomwhlo3dx.pocket-7e2413.testnet` runs the v3 wallet code (with `send_private`), has a phone key and no full access key, and caps NEAR at 0.1 per send and 0.2 per 24 hours.

| Step | Result | Transaction |
| --- | --- | --- |
| create the wallet: code, phone key, `new` with tight caps and the pool, in one transaction | ok | [5QPFhKCQ…](https://testnet.nearblocks.io/txns/5QPFhKCQntXcUb9HU2gcEumzVecncrz4H9BcgG9bwDPA) |
| private send 1 (0.1 NEAR) through `send_private` | ok, the pool logs a deposit; 91 Tgas in the pool | [2uxmAxN8…](https://testnet.nearblocks.io/txns/2uxmAxN8SaZsWsM8dT88in6N7atBdAjcHFp4x3U3F9Ni) |
| private send 2 (0.1 NEAR) | ok | [3FbxmCsZ…](https://testnet.nearblocks.io/txns/3FbxmCsZSapRKJzZ53kobmupqvsn5njpHhGzxBCnJdy7) |
| attack: a third private send in the same 24 hours | refused by the wallet: "Over your 24 hour limit for NEAR." | [J2XZMLz3…](https://testnet.nearblocks.io/txns/J2XZMLz3DBoyCQTGwXzwuYFT2kAcCihDnKgVhZLnxBiK), again [B5My1WCQ…](https://testnet.nearblocks.io/txns/B5My1WCQ7ys5qLeY1fFvhVHyJ2JzJ1xdCFGBHG34srXB) |
| attack: a public `send_near` after the cap is used | refused: same cap, shared by public and private sends | [3Ab5uQ93…](https://testnet.nearblocks.io/txns/3Ab5uQ93DX7R3m6CpnXdWjaKkDZBT667Q8dbcKsPPptu) |
| attack: one 0.2 NEAR private send | refused: "Over your per send limit for NEAR." | [44gXFiu3…](https://testnet.nearblocks.io/txns/44gXFiu3T2pqztwQaXbWbu9sZCqNdvA3jDXyVHNaLW2N) |
| attack: private send without a signed price | refused (here by the daily cap, which is checked first; the price refusal is unit test `private_send_needs_a_signed_price`) | [6dmpU5AC…](https://testnet.nearblocks.io/txns/6dmpU5ACuGXQygoYk4n7x65p7PQZN44mP4zugtyWu7Qz) |
| relayer pays one of the wallet's notes to a brand new account `8a9e8ab9…` | ok | [AK8yFge6…](https://testnet.nearblocks.io/txns/AK8yFge6kgcFiuTgzBfSdFGx78BgqZUPgJuLhuiEwsjv) |

`get_spent` on the wallet after the run: 0.2 NEAR and $0.624 counted, exactly the two private sends.

## Deployment

| What | Where |
| --- | --- |
| Pool contract | [pool.pocket-7e2413.testnet](https://testnet.nearblocks.io/address/pool.pocket-7e2413.testnet), wasm sha256 `4f49a70dceadf26dda72fbb9e10a9105073917aab130ebf1f17c4936c1744190` (`vendor/pocket_pool.wasm`) |
| Create, deploy, init | [9pus9eod…](https://testnet.nearblocks.io/txns/9pus9eodYmpx3QmEAvaq2qgem635duCNSutej8d4ZD72), [4H2CVLm5…](https://testnet.nearblocks.io/txns/4H2CVLm5HKsihwaWYYsSuTVdYUwmcTQGZJbjZm4TQY2c), [FigLF6hS…](https://testnet.nearblocks.io/txns/FigLF6hSRFSgomJFqNAvQiV9A1WzdQCub2ZPyvxboayg) |
| Wallet v3 code | sha256 `b8533fdff14e33c30e358cfb3b925e3e1cbb47b14cac17ea970dac658e4062c1` (`vendor/pocket_wallet.wasm`); NEAR code hash `DQXeGy6AJ1t2q4EhoDJ1MPwPpmSRyzRMrKi3uygwDAkY`. Deployed on the demo wallet above. **Not yet deployed as the global contract**: that needs about 22.5 testnet NEAR ([failed attempt, LackBalanceForState](https://testnet.nearblocks.io/txns/E1CQAotyW57L2XvtdsETXdz2D4UcvkZefJXhhygS1f3o)). |

## Things that went wrong, said plainly

* Three leaves in the pool (indexes 0, 1 and 4) can never be spent: two early script runs crashed before saving the note secret, and one rerun overwrote a notes file. That is 0.3 testnet NEAR stuck for good. The scripts now refuse to start without a secrets folder and append notes instead of overwriting them. The stuck leaves look like any other deposit, so they only add to the crowd.
* To pay for the pool, 7.5 testnet NEAR was first moved from `pocketnear.testnet`, which turned out to be the sponsor of the live `main` deployment. 5 NEAR was sent back at once ([tx](https://testnet.nearblocks.io/txns/FHH9ZPAeebME3jXWFR3BL3iEZjGYxnHTyqQCNfV8bubG)); 2.5 NEAR is still owed and will be returned when the faucet allows. The live site kept working (about 5.4 NEAR is enough for many signups at 0.1 each).
