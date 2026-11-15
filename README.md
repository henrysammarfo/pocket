<p align="center"><img src="public/brand/coil.svg" width="64" alt="Pocket" /></p>

# Pocket: a money app you talk to

*Live on NEAR testnet. Open source, MIT.*

**The problem.** Sending money home, holding dollars or buying a stock usually means several apps, fees you only see later, and screens that assume you already know finance. AI could help, but nobody should hand an AI their keys.

**What Pocket does.** You talk to it like a friend: *"Send Mum 50 dollars and put 25 in Tesla"*. Pocket tells you what it understood and shows one simple plan card. It checks the plan against your own rules, and nothing moves until you **press and hold to approve** on your own device. You never pay network fees, and every payment gets a receipt you can check on the public NEAR record.

**Try it in two minutes: https://pocket-zeta-lime.vercel.app**
1. Tap **Get started**. Pocket makes you a free testnet account and adds 1,000 test dollars.
2. Type or say *"send @admin 2 dollars"*. You see one plan card.
3. Press and hold to approve. You see a receipt with a link to the public record.
4. Ask for today's news or the Tesla price, or add a receipt photo and ask Pocket to split the bill.

**Safe by design.** The AI never holds your keys and can only suggest. Your rules are checked in code, and your device signs every payment. On the `onchain-limits` branch the caps live in a smart contract on your account and the browser holds only a limited key, see [On chain spending limits](#on-chain-spending-limits-this-branch).

**Private by design.** Chats, photos and voice notes are read by AI running in sealed, checkable hardware on NEAR AI Cloud. Pocket's server keeps no chat text; your history stays in your browser. What this does and does not protect is written down plainly in [What the TEE does and does not protect](#what-the-tee-does-and-does-not-protect).

**Testnet only. No real money.** Test dollars (pUSD), Circle testnet USDC and paper stocks (TSLAon, NVDAon, AAPLon, SPYon, QQQon) with live prices. Test results: [docs/TEST_REPORT.md](docs/TEST_REPORT.md). Hackathon diff: [near-baseline...main](https://github.com/henrysammarfo/pocket/compare/near-baseline...main). Technical detail for reviewers and AI judges starts below.

## On chain spending limits (this branch)

This branch, `onchain-limits`, moves the spending rules from Pocket's server into a NEAR smart contract on every user account. The live site above still runs `main` as submitted. This branch runs on its own fresh testnet deployment, root `pocket-7e2413.testnet`.

**How it works.** At signup Pocket creates your account, points it at the Pocket wallet contract (a NEAR global contract fixed by its code hash, so nobody can swap the code under you), and adds two keys in one transaction:

1. A **phone key** kept in the browser. It is a function call access key that can only call your own account, only these methods: `send_near`, `send_usdc`, `send_token`, `trade`, `lower_limits`, `cancel_pending`. It has a gas allowance of 0.25 NEAR and it cannot attach a deposit, add keys, deploy code or call any other contract.
2. A **recovery key**, the only full access key. Pocket shows it once, you copy or download it, and it is never stored in the browser.

Pocket still pays gas for normal use through the relayer (NEP-366 meta transactions), so the phone key's allowance is only spent if you send a transaction yourself.

**What the contract enforces on chain.** Every rule below is checked in Rust by `contracts/wallet`. A call that breaks a rule panics, and a panic in NEAR rolls back all state, so nothing moves.

| Rule | Default |
| --- | --- |
| Dollar cap per send (pUSD and USDC) | $100 |
| Dollar cap per rolling 24 hours, counted in hourly slots | $200 |
| NEAR cap per send and per 24 hours | 1 NEAR and 2 NEAR |
| Cap per stock token per send and per 24 hours | 5 and 20 shares |
| Largest single trade | $1,000 |
| Which actions are allowed: NEAR, USDC, tokens, trades | all on |
| Allow only list of recipients, and a block list | empty |
| NEAR sends always leave storage cost plus 0.01 NEAR | always |
| Trades go only to the Pocket market contract and only at a quote signed by Pocket's quote key, used once, before its deadline | always |

Sends reserve the amount before the token call and the callback gives it back if the call fails, so many sends racing in the same block can never pass the daily cap. In the testnet run, ten $40 sends fired at once from ten keys against a $200 day let exactly five through and the chain refused the other five.

**Changing the rules.** Lowering a cap, adding a block, or narrowing the allow list takes effect at once and the phone key may do it. Raising anything needs the full access recovery key: it either waits out a delay (24 hours by default) and is then applied by the next send, or the phone key may cancel it during the wait. The recovery key can also set rules instantly by calling the contract directly, which is the "full key" path. Whether a change is a raise is decided by the contract, field by field.

**Trades.** The phone key calls `trade` on its own account. The contract checks the trade size and the market account, then moves the tokens through NEAR Intents `mt_transfer_call` to `market.pocket-7e2413.testnet`. The market contract checks Pocket's ed25519 signed quote (account, amounts, deadline, one time id) and either pays out or returns the full amount. A tampered, expired, replayed, or foreign quote gets a full refund.

**Server checks stay as a second layer.** The relayer still checks every meta transaction (allowed methods, no deposit, gas cap, amounts, recipients) and keeps rate limits. The chat and the plan card still check rules before you approve. If the server were compromised, the contract still holds.

**What is not enforced on chain, said plainly.**

* Anyone holding the recovery key controls the account, as with any full access key. It could remove the contract. Keep it offline.
* When Pocket relays a call, NEAR reports the relayer as the signer, so the contract cannot tell which key signed a relayed call. Relayed calls are limited by the phone key's method list, which leaves out every rule raising method. Direct calls also check the signer is a registered owner key.
* NEAR and stock caps are counted in units, not dollars, because there is no price oracle on chain. Only pUSD and USDC count as dollars.
* Trades have their own per trade cap and do not count against the daily send cap. Their price is set by Pocket's signed quote, not by an on chain market.
* The rolling day uses hourly slots, so a send drops out of the window between 23 and 24 hours later.
* Accounts made before this branch are not moved over. They keep the old server enforced flow, and the old NEAR Intents routes remain only for them.
* The browser end to end suites were not rerun against this branch; the testnet attack suite and unit tests below were.

**Check it yourself.**

```bash
npm run verify:chain     # market code and the wallet global code hash match vendor/pocket_maker.wasm and vendor/pocket_wallet.wasm
npm run test:contracts   # Rust unit tests for the wallet (51, including model based checks) and market (13) contracts
npm run test:onchain     # testnet attack suite (needs .env.local from npm run setup): 67 checks
```


**Explorer links from the latest testnet attack run** (67 passed, 0 failed):

| Step | Transaction |
| --- | --- |
| olamwhenffw.pocket-7e2413.testnet | [tx](https://testnet.nearblocks.io/txns/EEoGBJYyTTWuTWGqrZ8gENujZ7h1TWHp5MAgvDx4rUGT) |
| send $50 pUSD gasless through the relayer | [tx](https://testnet.nearblocks.io/txns/5oo6dD7qD3wwTTvZiq8mv6nnB391eUa3MNu9J8YjqpLd) |
| $100 send within caps goes through | [tx](https://testnet.nearblocks.io/txns/GfHt6LhfgMty9H9a9EWcRrBktfJe1Cy6dRajZ454i7uS) |
| buy $20 of TSLAon through the wallet and the market | [tx](https://testnet.nearblocks.io/txns/5bbzbSjudbhTiNFCA31s1tZUnmkwm6jmmdw1jN87mrza) |
| paying with the request memo marks it paid | [tx](https://testnet.nearblocks.io/txns/3XgXvmix7kspgCtcLDQpoDaZ5CAGp6TFFepXjtqz4Ugi) |
| sending it back with the refund memo marks it refunded | [tx](https://testnet.nearblocks.io/txns/Haq6fkQsPJvi37hsecZF4zXf3nZddXd5pemokFVUSHEy) |

Full log: [docs/TEST_REPORT.onchain.md](docs/TEST_REPORT.onchain.md). Rule by rule detail: [docs/POLICY.md](docs/POLICY.md).

## Receipts export, request links and receiver checks (this branch)

**Receipts as CSV.** Activity has a download button that saves every receipt as a CSV file: date in UTC, type, asset, amount (minus for money out), dollars for trades, the other account, the memo, the transaction id, a link to the Pocket receipt and a link to NearBlocks. Text that a spreadsheet would run as a formula gets a leading apostrophe, so a memo someone sent you cannot run code in Excel or Google Sheets. Code: `src/lib/shared/csv.ts`, tests: `tests/unit/receipts.test.ts`.

**Request money links.** Wallet, Request money makes a link like `/pay/ama?r=k3j9x0q2m1zp` for an amount in pUSD or USDC with an optional note. The payer opens it, sees who is asking and how much, and pays with one hold. The payment carries the memo `pocket request <id>`, and the link and your list show **Pending**, then **Paid** with the payer and the receipt, and **Refunded** once you send the same amount back to the payer with one tap (memo `pocket refund <id>`). The status is worked out from transactions the chain accepted, never from what someone typed. Code: `src/lib/shared/request.ts`, tests: `tests/unit/requests.test.ts` and section 10 of the testnet run.

**Receiver check: allow, warn or block, with reasons.** Before every send Pocket looks at who gets the money.

* **Block:** not a valid NEAR name, your own account, a NEAR mainnet name (Pocket is testnet only), a Pocket system or token contract, an account on your block list, an account outside your allow only list, or a named account that does not exist on chain.
* **Warn:** you never paid them before, the account is outside Pocket, it is a smart contract rather than a Pocket wallet, it is an unused implicit address, Pocket could not reach the chain, or the name looks like someone you paid before (one letter off, swapped letters, 0 for o, 1 for l, rn for m, the same name under another root).
* **Allow:** a saved contact or someone you paid before.

The send screen shows the reasons and will not let you hold to send on a block. The server runs the same check again before it pays gas and refuses a block, so a modified app cannot skip it; the wallet contract enforces your block and allow lists on chain as well. Code: `src/lib/shared/receiver.ts`, tests: `tests/unit/receiver.test.ts`.

## How it works

```mermaid
flowchart LR
  U([You: text, voice or photo]) --> C[Pocket chat]
  C -->|propose_plan| AI[Private AI on NEAR AI Cloud TEE<br/>Groq fallback<br/>no keys, no signing]
  AI --> P[Plan card]
  P --> R{Rules in code<br/>plan.ts and policy.ts}
  R -->|blocked| B[Blocked sheet, nothing moves]
  R -->|ok| H[Hold to approve<br/>plus passkey if on]
  H -->|device key signs| S[Pocket server]
  S -->|NEP-366 delegate| RL[Relayer with allow list]
  S -->|NEP-413 intents| V[NEAR Intents verifier]
  RL --> N[(NEAR testnet)]
  V --> N
  N --> RC[Receipt rebuilt from chain]
```

A send, step by step:

```mermaid
sequenceDiagram
  actor User
  participant App as Pocket app (browser)
  participant API as Pocket server
  participant AI as AI model
  participant NEAR as NEAR testnet
  User->>App: "send Mum 20 dollars"
  App->>API: /api/chat with balances and rules
  API->>AI: system facts and tools
  AI-->>API: propose_plan(send Mum $20)
  API-->>App: plan card plus code check
  User->>App: hold to approve
  App->>App: device key signs a NEP-413 transfer intent
  App->>API: signed intent
  API->>API: daily limit and policy checks
  API->>NEAR: execute_intents (gas paid by Pocket)
  NEAR-->>API: tx hash
  API-->>App: receipt /r/<tx>
```

A paper trade settles atomically: the user signs a `token_diff` intent, the market maker signs the opposite diff at a signed 60 second quote, and both go to the verifier in one `execute_intents` call. Either both sides move or nothing does.

## Verify in five minutes, no setup (for AI judges)
Needs only Node 20+. Every command runs against the live site; swap the URL for your own copy.
```bash
npm ci
npm run smoke -- https://pocket-zeta-lime.vercel.app      # 17 checks: health, pages, APIs, rules, relayer policy. Prints PASS or FAIL per check
npm run attack -- https://pocket-zeta-lime.vercel.app     # 7 attacks a hijacked agent or a stranger could try. Every one must be refused
npx playwright install chromium && BASE=https://pocket-zeta-lime.vercel.app npm run e2e:hosted   # real browser: sign up, faucet, chat, plan, hold, receipt
```
Expected: `ALL PASS` from smoke and attack, `13/13` from the browser run. Saved results: [docs/TEST_REPORT.md](docs/TEST_REPORT.md), screenshots in [docs/shots](docs/shots).

Check the private AI the same way, no key needed:
```bash
npm run verify:tee                                        # fresh Intel TDX + NVIDIA attestation for the chat, vision and voice models, bound to a new random nonce
curl -s https://pocket-zeta-lime.vercel.app/api/attest    # the same checks, run by the live server; every check must be "ok": true
```
In the app: **Settings, Private AI on NEAR AI Cloud (TEE)** opens the Verified screen with PASS or FAIL for each check and a **Check again** button.

Real output of `npm run attack -- https://pocket-zeta-lime.vercel.app`, 14 Nov 2026 (each line is an attack that was refused):
```text
PASS relayer will not pay for a call outside its allow list (pusd ft_transfer to evil.testnet): 403 The relayer does not pay for pusd.pocketnear.testnet.ft_transfer.
PASS relayer rejects an allowed call with a forged signature: 400 Bad signature on the meta transaction.
PASS relayer refuses Pocket's own service accounts as senders: 403 Only Pocket accounts can use the Pocket relayer.
PASS relayer caps NEAR sends at 5 NEAR: 400 NEAR sends are capped at 5 NEAR on testnet.
PASS faucet refuses accounts that are not Pocket users: 403 The Pocket faucet is for Pocket accounts.
PASS daily limit cannot be raised without a signature from the user's key: 400 Bad signature.
PASS prompt injection cannot get past the rules: plan blocked: Your rule keeps $0. This plan would leave $0.00. You have $1000.00, and this plan needs $5000.00. 
ALL PASS
```

## Judging criteria to evidence
| Criterion | What to check | Evidence |
| --- | --- | --- |
| Technical implementation | Real NEAR standards, no mocks: NEP-413 intents, NEP-366 meta transactions, NEP-141 tokens, the unmodified NEAR Intents verifier | [pool.ts](src/lib/server/pool.ts) (relayer policy `delegatePolicy`, faucet, quotes, atomic `execute_intents`), [intents.ts](src/lib/shared/intents.ts), [nep413.ts](src/lib/shared/nep413.ts), [contracts/token](contracts/token), `npm run judge` prints NearBlocks links, `npm run verify:chain` proves the deployed code hashes match `vendor/*.wasm` |
| Safety of AI with money | The model only proposes; rules are checked in code; the user signs on device; the relayer pays only for allowed calls | [docs/POLICY.md](docs/POLICY.md) (every rule, its code and its test), [policy.ts](src/lib/shared/policy.ts), [plan.ts](src/lib/shared/plan.ts), property based and fuzz tests in [tests/unit/policy.test.ts](tests/unit/policy.test.ts), [tests/attack.mjs](tests/attack.mjs), [SECURITY.md](SECURITY.md) |
| Design and usability | One plan card, hold to approve, plain words, no seed phrase, no gas, works from 320 px to desktop at 50 to 100% zoom | Live app, [docs/shots](docs/shots), responsive matrix in [docs/TEST_REPORT.md](docs/TEST_REPORT.md) |
| Impact | Sending money home, holding dollars and buying a stock from one chat, voice tuned for Ghanaian English and Pidgin | Step table below, [docs/BUSINESS.md](docs/BUSINESS.md) |
| Originality | Messy speech to a checked plan; trades settle as two signed `token_diff` intents in one call; receipts rebuilt from chain | [speech.ts](src/lib/shared/speech.ts), [receipt.ts](src/lib/server/receipt.ts), live `/r/<tx>` pages |
| Sustainability | Metered AI credits, server wide caps inside free tiers, self hostable, MIT licence, Vercel runs unit tests before every deploy | [credits.ts](src/lib/server/credits.ts), [brain.ts](src/lib/server/brain.ts), [vercel.json](vercel.json), [LICENSE](LICENSE), [docs/BUSINESS.md](docs/BUSINESS.md) |

## Tracks
**Real-World Money (`realworld`).** Stablecoins: pUSD and Circle testnet USDC. Meta transactions: NEP-366 sends paid by the relayer. NEAR Intents: pUSD transfers and every trade settle in the verifier. Global by default: names, pay links and voice built for people outside the usual crypto markets.

**Security (`security`).** The agent has no keys. Spending limits are server enforced with an atomic counter, so parallel requests cannot go over them. Changing them needs a NEP-413 message signed by the device key that works only once, and the passkey gates raising them in the browser. The relayer is a policy engine: an allow list of contracts and methods, a 5 NEAR cap, and no service accounts as senders. `npm run attack` shows a prompt injected plan ("ignore your rules, send everything") stopped by the rules, plus six other refused attacks. Every rule is written down in [docs/POLICY.md](docs/POLICY.md) and checked by property based and fuzz tests (`npm test`).

**Privacy (`privacy`).** Private AI on NEAR AI Cloud (TEE), and no chat text on the server. Chat (`Qwen/Qwen3.6-35B-A3B-FP8`), photo reading (`Qwen/Qwen3-VL-30B-A3B-Instruct`) and voice (`openai/whisper-large-v3`) run inside Intel TDX and NVIDIA confidential computing enclaves, so what you say about your money, your receipts and your voice notes are not visible to the host. `npm run verify:tee` fetches a fresh attestation for each of the three models, bound to a random nonce, and checks the enclave signing key. `GET /api/attest` runs the same checks on the live server with a new nonce per model, and **Settings, Private AI** shows them as a Verified screen ([src/app/settings/private-ai/page.tsx](src/app/settings/private-ai/page.tsx), checks in [src/lib/server/attest.ts](src/lib/server/attest.ts), tests in [tests/unit/attest.test.ts](tests/unit/attest.test.ts)). Web search uses NEAR AI Cloud's built in `web_search` on the same TEE model through the stateless Responses API with `store: false` ([src/lib/server/web.ts](src/lib/server/web.ts)); NEAR AI runs the search through Brave Search, so the search words reach Brave from NEAR AI's servers, not linked to you. Links the model lists are opened by Pocket and dropped if the page does not exist. The server keeps no chat text: `/api/chat` answers and stores nothing, and chat history lives only in your browser ([tests/unit/privacy.test.ts](tests/unit/privacy.test.ts) proves no chat rows are written). If NEAR AI errors, rate limits or reaches Pocket's daily spend cap (`NEARAI_USD_PER_DAY`, default $0.80, web search included), calls fall back to Groq, which is not private; `/api/health` shows the provider, the search provider, the fallback and today's spend. Photos are not stored, and seed phrases and passwords are never saved to memory. See [What is stored, where](#what-is-stored-where).

```mermaid
flowchart LR
  U[Your message, photo or voice] --> S[Pocket server<br/>rules, limits, credits]
  S -->|first: chat, photos, voice, web search| N[NEAR AI Cloud<br/>TEE: TDX + NVIDIA CC<br/>store: false]
  S -.->|error, rate limit or daily cap| G[Groq fallback<br/>not private]
  N --> P[Plan card<br/>you hold to approve]
  G --> P
  B[(Your browser<br/>key, chat history)] --- U
```

**Open Innovation (`open`).** A money app driven by speech, tuned for Ghanaian English and Pidgin, with chain abstraction throughout: named accounts and pay links instead of addresses, no gas and no seed phrase for the user, one plan card for a send plus a trade.

### Track evidence: hint, file, proving command
| Track | Hint from the organizers | Where it is in the code | Command that proves it |
| --- | --- | --- | --- |
| realworld | Stablecoins | pUSD NEP-141 [contracts/token](contracts/token), Circle testnet USDC in [src/lib/shared/deployment.ts](src/lib/shared/deployment.ts) | `npm run judge` (faucet, sends, NearBlocks links) |
| realworld | Meta transactions | NEP-366 relayer with an allow list, `delegatePolicy` in [src/lib/server/pool.ts](src/lib/server/pool.ts) | `npm run attack -- <url>` (calls outside the allow list refused) |
| realworld | NEAR Intents | Unmodified verifier v0.4.2, [src/lib/shared/intents.ts](src/lib/shared/intents.ts), atomic `execute_intents` in [src/lib/server/pool.ts](src/lib/server/pool.ts) | `npm run verify:chain` (deployed code hash matches `vendor/defuse.wasm`), `npm run judge` (trade settles) |
| security | Agent security, policy engine | The AI only proposes: [src/lib/shared/plan.ts](src/lib/shared/plan.ts), [src/lib/shared/policy.ts](src/lib/shared/policy.ts), every rule in [docs/POLICY.md](docs/POLICY.md) | `npm test` (property and fuzz tests), `npm run attack -- <url>` (prompt injection blocked) |
| security | Function call keys | Not used for the user key (needs a 1 yocto deposit); limit and on chain design in [docs/POLICY.md](docs/POLICY.md#what-is-not-enforced-on-chain-and-why) | Read the section; honest gap |
| security, privacy | TEE attestation | [src/lib/server/attest.ts](src/lib/server/attest.ts), [scripts/verify-tee.mjs](scripts/verify-tee.mjs) | `npm run verify:tee`, `curl <url>/api/attest` |
| privacy | Private AI, NEAR AI Cloud | Provider chain in [src/lib/server/llm.ts](src/lib/server/llm.ts), private web search in [src/lib/server/web.ts](src/lib/server/web.ts) | `curl <url>/api/health` (`aiPrivate: true`, `webSearch.private: true`) |
| privacy | Keep nothing server side | [src/app/api/chat/route.ts](src/app/api/chat/route.ts) stores nothing; history only in the browser | `npx vitest run tests/unit/privacy.test.ts` |
| open | Chain abstraction | Names and pay links [src/lib/shared/address.ts](src/lib/shared/address.ts), gasless relayer, speech cleanup [src/lib/shared/speech.ts](src/lib/shared/speech.ts) | `BASE=<url> npm run e2e:hosted` |

## What the TEE does and does not protect
**What it protects.** Chat, photos and voice run on NEAR AI Cloud inside a trusted execution environment (Intel TDX for the CPU, NVIDIA confidential computing for the GPU). That keeps prompts hidden from the cloud host and the operator. Pocket does not just trust this: `npm run verify:tee` and `/api/attest` fetch a fresh attestation bound to a random nonce we pick, and check the enclave signing key before we rely on it.

**What it does not protect.** A TEE cannot fix a bug in the inference software running inside it. On 8 Nov 2026 a remote code execution bug in SGLang let an attacker run code on one NEAR AI inference server and see requests being processed there, including confidential ones. NEAR AI fixed it on all servers and published a report: [NEAR AI Security Incident Report: SGLang Vulnerability](https://near.ai/blog/security-incident-report-sglang-vulnerability). So treat the TEE as strong protection against the host, not as a promise that nothing can ever leak.

**How Pocket limits the damage if a prompt does leak.**
* Pocket's server relays chat text to the model and stores none of it. Chat history lives only in your browser. Copies saved by older versions were deleted on 14 Nov 2026, so the `pocket_chat` table now has 0 rows.
* The AI never holds keys, so a leaked or tampered prompt cannot move money. The model can only propose a plan card.
* Every send is signed by the key on your own device after you hold to approve, and is checked against your server enforced daily limit and keep amount and the relayer allow list (allowed contracts and methods only, with a cap per send). On this branch the device key is a function call key that can only call the Pocket wallet contract on your own account, and the contract enforces the caps on chain; see [On chain spending limits](#on-chain-spending-limits-this-branch).
* Web search queries go to Brave Search through NEAR AI, so a query does leave the enclave for the search provider. When NEAR AI returns no results with real links, that one search falls back to Groq, which is not private.

## What is stored, where
| Data | Where it lives | Notes |
| --- | --- | --- |
| Your account key (ed25519) | Your browser only | Back it up from Profile; Pocket's server never sees it |
| Chat history and chat titles | Your browser only | The server keeps no chat text. Deleting a chat also deletes any copy saved by versions before 14 Nov 2026 |
| Name, email, avatar, contacts, rules | Your browser only | |
| Memories you ask Pocket to keep ("remember that Mum is ama.testnet") | Neon Postgres, per account | Short facts only, never keys or passwords; listed in Settings, where you can forget any item |
| AI credit counters, rate limit counters, daily send totals | Neon Postgres | Numbers only |
| Activity index (kind, transaction hash, amounts) | Neon Postgres | Everything in it is already public on chain |
| Photos and voice notes | Nowhere | Read in memory by the private model, then dropped |
| Prompts and replies at NEAR AI Cloud | Not stored | TEE inference; search uses the stateless Responses API with `store: false` |
| Balances and receipts | NEAR testnet | Always read from the chain |

## Security notes
* Testnet only. Every account ends in `.testnet`; the faucet only serves Pocket accounts and is rate limited per account and per IP.
* Server keys (sponsor, relayer, maker, faucet) live in env vars only; see [.env.example](.env.example). Nothing secret is in the repo.
* The browser key is a function call key scoped to the user's own wallet contract and its spending methods. The wallet contract attaches the 1 yocto deposits itself, so the browser key never needs one. The only full access key is the recovery key, shown once and never stored in the browser. What stays off chain is listed in [On chain spending limits](#on-chain-spending-limits-this-branch) and [docs/POLICY.md](docs/POLICY.md#what-is-not-enforced-on-chain-and-why).

## One command setup (your own testnet copy)
Needs Node 20+. [near CLI](https://github.com/near/near-cli-rs) is used if installed, otherwise setup runs it through npx. No Rust needed: the token wasm is prebuilt in `vendor/` with its sha256 (`BUILD_TOKEN=1` rebuilds it with [cargo-near](https://github.com/near/cargo-near)).
```bash
npm ci
npm run setup    # creates a testnet root with the faucet, deploys verifier + tokens, writes .env.local
npm run judge    # end to end on testnet, prints PASS with NearBlocks links. With no .env.local it runs the no setup checks on the live site instead
npm run dev      # open http://localhost:3000
```
Optional: add `NEARAI_API_KEY` from cloud.near.ai for private AI and private web search, and a free `GROQ_API_KEY` from console.groq.com for the fallback, to `.env.local`. Without it everything still works with the built in helper and browser speech.
Have a funded testnet account already? `ROOT=you.testnet npm run setup` (key in `~/.near-credentials/testnet`). AI agents: see [AGENTS.md](AGENTS.md).

## Try it in five steps (do X, see Y)
| Do | See |
| --- | --- |
| 1. Open https://pocket-zeta-lime.vercel.app (or your own copy), pick a username, tap **Create my Pocket** | A real account `name.pocketnear.testnet` is created for you, gas paid by Pocket. You land in Chat |
| 2. Wallet, tap **Get test dollars** | 1,000 pUSD arrive from the faucet, with a NearBlocks link |
| 3. In Chat type or say *"ehm send send @admin like five dollars and put 10 in Tesla"* | Pocket cleans up the messy speech, confirms what it heard, and shows one plan card with two steps checked against your rules |
| 4. **Review and approve**, then press and hold the button for 1.2 s | The send and the TSLAon buy settle on testnet, gas paid by the relayer |
| 5. Open the receipt | A public page rebuilt from the chain: signed intents, price, spread and source |
| 6. In Chat, attach the sample receipt [public/samples/receipt.png](public/samples/receipt.png) (fictional) and type *"split it with @admin"* | The private vision model reads the items and total, and a split plan card appears |
| 7. Settings, tap **Private AI on NEAR AI Cloud (TEE)** | The Verified screen runs a fresh attestation and shows PASS for every check on the chat, vision and voice models |

Settings shows your **AI credits meter** and **what Pocket remembers** about you (you can forget any item). Everything above is covered by `npm run test:all`.

## What works end to end (live on NEAR testnet)
| Feature | How |
| --- | --- |
| Sign up with a username | Browser makes an ed25519 key; sponsor creates `name.root.testnet` with 0.05 NEAR |
| Gasless sends of pUSD, USDC, NEAR | pUSD: NEP-413 signed `transfer` intent, relayed `execute_intents`. USDC and NEAR: NEP-366 delegate actions paid by the relayer |
| Send by saved name, `@username`, `.testnet` account, NEAR 0x account or pay link `/pay/name` | `src/lib/shared/address.ts`, never guesses a network |
| Chat that talks about anything | Small talk, money questions and planning privately on NEAR AI Cloud (`Qwen/Qwen3.6-35B-A3B-FP8` in a TEE), falling back to Groq (`openai/gpt-oss-120b`); any OpenAI compatible API works. Tool calls `propose_plan`, `confirm_intent`, `remember`. The AI never signs; money only moves through plan cards. With no key, a built in helper still reads money commands |
| Voice | Tap or hold the mic, or attach a voice note (m4a, mp3, ogg, opus, wav, webm). Whisper large v3 (private on NEAR AI Cloud, Groq fallback) transcribes with a prompt tuned for Ghanaian English and Pidgin; `src/lib/shared/speech.ts` strips fillers, stutters and repeats; Pocket says back what it understood before the plan. Falls back to the browser's own speech recognition with no key. Optional spoken replies in Settings |
| Memory | Short facts you ask Pocket to remember, per account in Neon Postgres, behind a NEP-413 signed session. Never keys or passwords, and never chat text |
| AI credits | 1,000 free a month per account, metered on the server from real token use, refunded on failure. Server wide caps keep it inside the free tier. See [docs/BUSINESS.md](docs/BUSINESS.md) |
| Hold to approve | 1.2 s fill, 200 ms reset on early release, then optional passkey, then the device key signs |
| Paper trading and swap | Signed 60 s quote with 0.20% spread from a live CoinGecko price; user and maker `token_diff` intents settle atomically in the verifier |
| Daily send limit | Server enforced; changing it is a NEP-413 message signed by the device key, raising it asks for the passkey when on |
| Always keep rule, $1,000 trade cap | Checked in `src/lib/shared/plan.ts` before approval |
| Faucet | 1,000 pUSD per account per day. Testnet USDC from faucet.circle.com |
| Live Invest | Token prices (Ondo tokenized stocks on CoinGecko), share prices and key stats (Nasdaq.com), charts 1D to All |
| Receipts `/r/<tx>` | Rebuilt from the transaction: signed intents, maker memo with price, mid, spread and source |
| Live answers | Today's date and time in your zone; news and current events through NEAR AI Cloud `web_search` on the private model (Groq `browser_search` as fallback), with source links; product finds with prices and photos read from the real store pages (Pocket opens every link and drops any page that does not exist) |
| Photos | Share a receipt or bill; a private vision model on NEAR AI Cloud (`Qwen/Qwen3-VL-30B-A3B-Instruct`, Groq `qwen/qwen3.8-27b` as fallback) reads items and total, and "split it with @ama" becomes a plan card. Photos are not stored |
| Chats | ChatGPT style list: new chat, rename, delete; a drawer on phones and a sidebar on desktop; saved only in your browser |
| QR | Receive shows your pay link as a QR code; Send can scan one from the camera (works on iPhone through the photo picker) |
| Profile | Name, email photo (Gravatar), original jersey or emoji avatars, pay link, key backup and restore |
| Themes | Light, pitch black `#000`, System |

## Roadmap, shown as Roadmap in the app
Cross chain sends (Solana, Ethereum, Polygon) and USDC to NEAR swaps need NEAR Intents bridges and 1Click, which have no testnet. Claim links for people not on Pocket yet. On chain passkey keys. Paid credit packs and trade fees (see [docs/BUSINESS.md](docs/BUSINESS.md)).

## How it is built
* Next.js 15 App Router, TypeScript, Lucide icons, Manrope. Design ported from the approved mockups.
* `contracts/token`: fixed supply NEP-141 (near-sdk 5), no mint. `vendor/defuse.wasm`: unmodified NEAR Intents verifier **v0.4.2 release asset**, sha256 `f67f9559b3b512c52dfa11723a28b9119bcf773ac01780370d6409e5f1fb20e5` (newer tags publish no wasm and no reproducible build, so v0.4.2 is the latest verifiable release).
* `src/lib/server/pool.ts`: account creation, relayer policy, faucet, quotes, settlement, limits. `src/lib/server/receipt.ts`: receipts from chain.
* Store: Neon Postgres when `DATABASE_URL` is set, in memory otherwise. Balances and receipts always come from the chain.
* RPC: FastNEAR testnet first, then the public testnet RPC.

## Deploy
Vercel: import the repo, set the env vars from `.env.example` (server keys from your `.env.local`), deploy. `vercel.json` pins the Next.js framework. Without server keys the app is read only.

## Tests
Browser suites, each runnable against any URL with `BASE=...`: `tests/e2e/hosted.mjs` (full journey), `tests/e2e/chat-abilities.mjs` (date, news, products, photo, chats drawer), `tests/e2e/passkey.mjs` (passkey on, approve, off, recovery with a virtual authenticator), `tests/e2e/personas.mjs` (five people: a student sending home, a market trader, a diaspora worker, a first time crypto user and an investor), `tests/e2e/screens.mjs` (screenshots at 375, 390 and 430 px).

`npm run test:all` runs everything from a clean state: lint, types, unit, a fresh build, a local smoke test, the testnet flow (`npm run judge`), real browser runs on phone and desktop with fresh profiles and fresh accounts, the responsive matrix (16 routes, 320 to 1440 px, 50 to 100% zoom, light and black), a hosted smoke test and the attack checks with `SMOKE_URL=...`. Latest results: **[docs/TEST_REPORT.md](docs/TEST_REPORT.md)** (`npm run report` writes it). Plan: [docs/TESTING.md](docs/TESTING.md). Vercel runs the unit tests before every build, so a failing test blocks the deploy.

## More
[docs/BUSINESS.md](docs/BUSINESS.md) how Pocket makes money and meters AI. [docs/SUBMISSION.md](docs/SUBMISSION.md) submission text and demo script. [SECURITY.md](SECURITY.md) threat model. [AGENTS.md](AGENTS.md) for AI judges.

## Disclosure
Built for the NEAR hackathon on top of an earlier Pocket prototype (branch `otari-devs-wilding`, tagged `near-baseline`); the NEAR version replaces its chain, wallet and backend. Built with AI coding help. Market data: CoinGecko, Nasdaq.com, ExchangeRate API. Brand marks: Simple Icons, Invesco, State Street; pUSD and paper token marks are Pocket originals. Paper money, not financial advice.

Other project by the same builder: [Settlemark: NEAR Settlement Thesis](https://github.com/henrysammarfo/near-settlement-thesis), a separate and independent entry in the Investment Thesis track (HACKATHON.md Q-015).
