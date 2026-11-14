# Pocket policy specification

This is the formal statement of every rule Pocket enforces before money moves. Each rule names the code that enforces it and the test that checks it. Rules marked **chain** are enforced by the NEAR protocol or the unmodified NEAR Intents verifier, so Pocket could not break them even if its server were compromised. Rules marked **server** are enforced by Pocket's relayer and bind the AI, the relayer and anyone using the Pocket API. Rules marked **client** are enforced in the app before the approve button works.

Notation: `u` is a Pocket user account (`label.ROOT`), `k` is the device key of `u`, `day(u)` is the dollar total `u` sent through Pocket today (UTC), `limit(u)` is the user's daily limit (default 200, at most 5,000), `keep(u)` is the user's always keep floor.

## Authority: who can sign what

| Actor | Holds | Can | Cannot |
| --- | --- | --- | --- |
| AI model | nothing | call `propose_plan`, `confirm_intent`, `remember` | sign, see a key, call any money route |
| Device key `k` (browser) | ed25519 full access key of `u` | sign NEP-413 intents for `u` in the verifier, sign NEP-366 delegate actions for `u` | act for any other account |
| Relayer | server env | pay gas for delegates and intents that pass R1 to R7 | change what `k` signed (chain checks the signature) |
| Maker | server env | sign the counter side of a quote it issued | settle without the user's matching signed `token_diff` |
| Faucet | server env | send 1,000 pUSD to Pocket users | serve non Pocket accounts (F1) |
| Sponsor | server env | create `label.ROOT` with the user's public key | get a key to the new account |

## Plan rules (client, `checkPlan` in `src/lib/shared/plan.ts`)

| Id | Rule | Test |
| --- | --- | --- |
| P1 | Every send amount is finite and above zero; dollar sends are at least $0.01, NEAR sends at least 0.00001 | `policy.test.ts` "an approved plan always keeps the floor" |
| P2 | Dollars after the plan `>= keep(u)` and `>= 0` | same property, 3,000 random plans |
| P3 | Dollar sends in the plan `<= limit(u) - day(u)` | same property |
| P4 | Each trade is between $0.01 and $1,000 and a sell never exceeds holdings | same property |
| P5 | NEAR sends total `<= ` the NEAR balance and `<= 5` | same property |
| P6 | Monotonic: adding a dollar send to a refused plan never makes it approved | "adding a dollar send never turns a refused plan" |

The client rules are a convenience and a second line. The server rules below hold even if a modified client skips them.

## Relayer rules (server, `delegatePolicy` in `src/lib/shared/policy.ts`)

A NEP-366 delegate is relayed only if all of these hold. Anything else returns 400 or 403 and the relayer pays nothing.

| Id | Rule |
| --- | --- |
| R1 | `senderId` is a Pocket user: exactly one label under ROOT, never `admin`, `verifier`, `maker`, `faucet`, `relayer` or a token account |
| R2 | One or two actions; `nonce`, `maxBlockHeight`, `gas`, `deposit` are strings of digits; account ids follow the protocol grammar; `publicKey` is ed25519 |
| R3 | NEAR transfers: the total across the delegate is at most 5 NEAR (not 5 per action) |
| R4 | `verifier.add_public_key`: the only action, deposit exactly 1 yocto, argument an ed25519 key |
| R5 | `usdc.storage_deposit`: deposit exactly 0.00125 NEAR, `registration_only: true` |
| R6 | `usdc.ft_transfer`: deposit exactly 1 yocto, valid receiver, amount above zero; its dollar value counts toward L1 |
| R7 | Every function call has at most 50 Tgas |
| R8 | The ed25519 signature over `sha256(borsh(DelegateAction))` verifies against `publicKey`, and `publicKey` is a full access key of `senderId` on chain (`assertKeyOf`) |
| R9 (chain) | The delegate nonce is above the access key nonce and `maxBlockHeight` is in the future; the protocol rejects replays |

Tests: `policy.test.ts` "relayer policy" fuzzes 4,000 random JSON bodies (every one is refused with a 4xx or accepted, never a crash), checks that no method outside the allow list is ever paid for on any contract, and checks R3 on random pairs of amounts. `npm run attack` checks R1, R6, R8 and R3 against a live server.

## Intent rules (server `checkSigned` in `pool.ts`, chain in the verifier)

| Id | Rule |
| --- | --- |
| I1 | `standard` is `nep413`, `recipient` is the verifier account, and the NEP-413 signature verifies (tag `2^31 + 413`, borsh payload) |
| I2 | The deadline is in the future and at most 10 minutes away (60 s plus 30 s for trades) |
| I3 | Transfers: one intent, one known token, a positive integer amount, a valid receiver that is not the sender |
| I4 | Trades: the user's signed `token_diff` equals the quote exactly, the quote HMAC matches, the quote is unexpired and used once, the price is fresh |
| I5 (chain) | The verifier rejects a reused nonce and checks the signer's key is registered for that account, so a signed intent settles at most once |
| I6 (chain) | A trade settles atomically: both `token_diff` intents in one `execute_intents` call, or neither |

## Limit and replay rules (server)

| Id | Rule | Code | Test |
| --- | --- | --- | --- |
| L1 | For every send, `day(u) + amount <= limit(u)`, enforced with one atomic increment and a take back, so parallel requests can never exceed the limit; if the chain rejects the send, the amount is refunded | `reserveSpend` | "parallel sends can never push the day over the limit" (150 random races) |
| L2 | Changing `limit(u)` needs a NEP-413 message signed by a full access key of `u`, recipient `pocket`, action `pocket.set_limit`, at most 2 minutes old, `0 <= limit <= 5000` | `setLimit` | `npm run attack` |
| N1 | A signed limit message is accepted once: its nonce is burned | `burnNonce` | "a nonce is accepted once" |
| D1 | Domain separation: Pocket messages use recipient `pocket`, intents use the verifier account, and the NEP-413 tag prefix means neither can be replayed as the other or as a NEAR transaction | `nep413.ts` | "changing the message, nonce or recipient breaks the signature" |
| S1 | Sessions for AI, memory and credits: recipient `pocket`, action `pocket.session`, at most 25 hours, signed by a full access key of `u`. A session cannot move money | `auth.ts` | smoke test |

## Faucet and rate limits (server)

| Id | Rule |
| --- | --- |
| F1 | The faucet serves only existing Pocket users, at most 3 times a day per account and 5 an hour per IP |
| F2 | Signups: 5 an hour per IP, 300 a day in total. Relays: 60 an hour per account, 120 per IP. Trades: 60 an hour per account. Limit changes: 30 an hour per account |
| F3 | The client IP comes from `x-vercel-forwarded-for` or `x-real-ip`, which the client cannot forge on Vercel |

## What is not enforced on chain, and why

The daily limit and the relayer rules bind the AI, the relayer and the Pocket API. They do not bind someone who already holds the user's device key, because that key can sign intents and submit them to the verifier directly. This is the same trust model as any self custodial wallet: the user is the only party with the key.

Why the browser key is a full access key today: NEAR function call access keys cannot attach a deposit, and three Pocket actions need one (`add_public_key` and `ft_transfer` need 1 yocto, NEAR sends move NEAR). A function call key scoped to the verifier also does not limit what the verifier lets that key do with in verifier balances, so it would look safer without being safer.

The roadmap design that makes limits hold on chain:
1. **Spending key and recovery key.** At signup the browser makes two keys. The recovery key is the only full access key and is wrapped by the passkey (WebAuthn PRF) or exported once. The spending key is a function call key on the user's own Pocket policy contract with a small gas allowance.
2. **Policy contract.** A per user contract holds the in verifier balance and enforces `limit(u)` per day, an allow list of receivers and the keep floor in Rust, then calls the verifier. The spending key can only call it.
3. **Server verified passkey** for raising limits (WebAuthn assertion checked on the server, not only in the browser).

This keeps today's user experience and moves L1, R3 and the keep floor from server rules to chain rules.
