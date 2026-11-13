# AGENTS.md: how an AI agent runs and checks Pocket

Pocket is a chat first money assistant on **NEAR testnet only**. Everything below works with your own keys. Nothing touches mainnet.

## Run it
```bash
git clone https://github.com/henrysammarfo/pocket && cd pocket && git checkout near-hackathon
npm ci
npm run setup     # needs near CLI (near-cli-rs) and cargo-near; creates a testnet root, deploys, writes .env.local
npm run judge     # end to end on testnet: signup, faucet, gasless sends, trade, receipts. Prints PASS
npm run dev       # http://localhost:3000
```
Already have a funded testnet account in `~/.near-credentials/testnet`? Run `ROOT=you.testnet npm run setup`.

## Check it
| What | Command |
| --- | --- |
| Unit tests (NEP-413, plan rules, address rules, units) | `npm test` |
| Types and lint | `npm run typecheck && npm run lint` |
| Full testnet flow (server side) | `npm run judge` |
| UI flow in a browser (needs a running server) | `BASE=http://localhost:3000 npm run e2e` |
| Responsive matrix 320 to 1440 px, 50 to 100% zoom, light and black | `BASE=http://localhost:3000 npm run e2e:responsive` |
| Deployed contracts and verifier hash | `GET /api/health` |

## Rules the code enforces
* The AI only proposes a plan (`propose_plan` tool). It never holds a key. The device key in the browser signs.
* Every plan is checked in code (`src/lib/shared/plan.ts`) before the approve button works: keep rule, daily limit, $1,000 trade cap, holdings.
* The server checks again: daily limit on every send, relayer policy (Pocket users only, allow listed methods, gas and deposit caps), quote HMAC, quote expiry, price age.
* Verifier is the unmodified NEAR Intents `defuse` v0.4.2 release wasm, sha256 `f67f9559…20e5`, checked at deploy time.

## Map
* `src/app/*` pages, `src/app/api/*` routes, `src/lib/server/pool.ts` all money movement, `src/lib/server/receipt.ts` receipts from chain.
* `contracts/token` fixed supply NEP-141 (no mint). `scripts/` setup, bootstrap, env.
