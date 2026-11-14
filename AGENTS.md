# AGENTS.md: how an AI agent runs and checks Pocket

Pocket, the money app you talk to, runs on **NEAR testnet only**. Everything below works with your own keys. Nothing touches mainnet.

## Run it
```bash
git clone https://github.com/henrysammarfo/pocket && cd pocket
npm ci
npm run setup     # needs near CLI (near-cli-rs) and cargo-near; creates a testnet root, deploys, writes .env.local
npm run judge     # end to end on testnet: signup, faucet, gasless sends, trade, receipts. Prints PASS
                  # (no .env.local yet? it runs verify:chain, smoke and attack on the live site instead)
npm run dev       # http://localhost:3000
```
Already have a funded testnet account in `~/.near-credentials/testnet`? Run `ROOT=you.testnet npm run setup`.

## Check it
| What | Command |
| --- | --- |
| Everything, from a clean state, with a report in test-results/summary.md | `npm run test:all` (add `SMOKE_URL=<hosted url>` for the hosted smoke test) |
| Unit, property based and fuzz tests (NEP-413, relayer policy, daily limit races, plan rules, address rules, units, messy speech) | `npm test` |
| Deployed contracts are exactly the code in `vendor/` (code_hash check, no keys) | `npm run verify:chain` |
| Every rule, the code that enforces it and its test | [docs/POLICY.md](docs/POLICY.md) |
| The NEAR AI Cloud model runs in an attested TEE (fresh Intel TDX and NVIDIA evidence, nonce bound) | `npm run verify:tee` |
| Types and lint | `npm run typecheck && npm run lint` |
| Full testnet flow (server side) | `npm run judge` |
| UI flow in a browser (needs a running server) | `BASE=http://localhost:3000 npm run e2e` |
| Responsive matrix 320 to 1440 px, 50 to 100% zoom, light and black | `BASE=http://localhost:3000 npm run e2e:responsive` |
| Chat and voice in a real browser, phone or desktop (`W=1440 H=900`) | `BASE=http://localhost:3000 npm run e2e:chat` |
| Smoke test any running copy | `npm run smoke -- https://your-url` |
| Attack checks against any running copy (all must be refused) | `npm run attack -- https://your-url` |
| Deployed contracts, verifier hash, AI provider and model | `GET /api/health` |

## AI and voice (optional)
Put a free `GROQ_API_KEY` (console.groq.com/keys) in `.env.local`: chat uses `openai/gpt-oss-120b`, voice uses `whisper-large-v3`. Or `NEARAI_API_KEY` with `AI_PROVIDER=nearai` for NEAR AI Cloud. With no key, Chat uses the built in helper and browser speech, and every test still passes.

## Rules the code enforces
* The AI only proposes a plan (`propose_plan` tool). It never holds a key. The device key in the browser signs.
* Every plan is checked in code (`src/lib/shared/plan.ts`) before the approve button works: keep rule, daily limit, $1,000 trade cap, holdings.
* The server checks again: daily limit on every send, relayer policy (Pocket users only, allow listed methods, gas and deposit caps), quote HMAC, quote expiry, price age.
* Verifier is the unmodified NEAR Intents `defuse` v0.4.2 release wasm, sha256 `f67f9559…20e5`, checked at deploy time.

## Map
* `src/app/*` pages, `src/app/api/*` routes, `src/lib/server/pool.ts` all money movement, `src/lib/server/receipt.ts` receipts from chain.
* `contracts/token` fixed supply NEP-141 (no mint). `scripts/` setup, bootstrap, env.
