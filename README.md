<p align="center"><img src="public/brand/coil.svg" width="64" alt="Pocket" /></p>

# Pocket: talk to your money, on NEAR testnet

Pocket is a chat first money assistant. Say *"Send Mum 50 dollars and put 25 in Tesla"*. Pocket turns it into a plan card, checks it against your rules in code, and nothing moves until you **hold to approve** on your own device. Sends are gasless, trades settle in one atomic call to the **NEAR Intents verifier**, and every move gets a public receipt rebuilt from the chain.

**Testnet only. No mainnet, no real money.** Test dollars (pUSD), Circle testnet USDC, and paper stock tokens (TSLAon, NVDAon, AAPLon, SPYon, QQQon) priced live.

## One command setup
Needs Node 20+, [near CLI](https://github.com/near/near-cli-rs) and [cargo-near](https://github.com/near/cargo-near) (only to build the token wasm).
```bash
npm ci
npm run setup    # creates a testnet root with the faucet, deploys verifier + tokens, writes .env.local
npm run judge    # end to end on testnet, prints PASS with NearBlocks links
npm run dev      # open http://localhost:3000
```
Have a funded testnet account already? `ROOT=you.testnet npm run setup` (key in `~/.near-credentials/testnet`). AI agents: see [AGENTS.md](AGENTS.md).

## What works end to end (live on NEAR testnet)
| Feature | How |
| --- | --- |
| Sign up with a username | Browser makes an ed25519 key; sponsor creates `name.root.testnet` with 0.05 NEAR |
| Gasless sends of pUSD, USDC, NEAR | pUSD: NEP-413 signed `transfer` intent, relayed `execute_intents`. USDC and NEAR: NEP-366 delegate actions paid by the relayer |
| Send by saved name, `@username`, `.testnet` account, NEAR 0x account or pay link `/pay/name` | `src/lib/shared/address.ts`, never guesses a network |
| Chat with plan cards | OpenAI compatible tool call (`propose_plan`, NEAR AI Cloud by default) or the built in rules parser when no AI key is set. The AI never signs |
| Hold to approve | 1.2 s fill, 200 ms reset on early release, then optional passkey, then the device key signs |
| Paper trading and swap | Signed 60 s quote with 0.20% spread from a live CoinGecko price; user and maker `token_diff` intents settle atomically in the verifier |
| Daily send limit | Server enforced; changing it is a NEP-413 message signed by the device key, raising it asks for the passkey when on |
| Always keep rule, $1,000 trade cap | Checked in `src/lib/shared/plan.ts` before approval |
| Faucet | 1,000 pUSD per account per day. Testnet USDC from faucet.circle.com |
| Live Invest | Token prices (Ondo tokenized stocks on CoinGecko), share prices and key stats (Nasdaq.com), charts 1D to All |
| Receipts `/r/<tx>` | Rebuilt from the transaction: signed intents, maker memo with price, mid, spread and source |
| Profile | Name, email photo (Gravatar), original jersey or emoji avatars, pay link, key backup and restore |
| Themes | Light, pitch black `#000`, System |

## Roadmap, shown as Roadmap in the app
Cross chain sends (Solana, Ethereum, Polygon) and USDC to NEAR swaps need NEAR Intents bridges and 1Click, which have no testnet. Claim links for people not on Pocket yet. On chain passkey keys. Voice input.

## How it is built
* Next.js 15 App Router, TypeScript, Lucide icons, Manrope. Design ported from the approved mockups.
* `contracts/token`: fixed supply NEP-141 (near-sdk 5), no mint. `vendor/defuse.wasm`: unmodified NEAR Intents verifier **v0.4.2 release asset**, sha256 `f67f9559b3b512c52dfa11723a28b9119bcf773ac01780370d6409e5f1fb20e5` (newer tags publish no wasm and no reproducible build, so v0.4.2 is the latest verifiable release).
* `src/lib/server/pool.ts`: account creation, relayer policy, faucet, quotes, settlement, limits. `src/lib/server/receipt.ts`: receipts from chain.
* Store: Neon Postgres when `DATABASE_URL` is set, in memory otherwise. Balances and receipts always come from the chain.
* RPC: FastNEAR testnet first, then the public testnet RPC.

## Deploy
Vercel: import the repo, set the env vars from `.env.example` (server keys from your `.env.local`), deploy. `vercel.json` pins the Next.js framework. Without server keys the app is read only.

## Tests
`npm test` (unit), `npm run judge` (testnet flow), `npm run e2e` and `npm run e2e:responsive` (browser, needs a running server). Security notes: [SECURITY.md](SECURITY.md).

## Disclosure
Built for the NEAR hackathon on top of an earlier Pocket prototype (branch `otari-devs-wilding`, tagged `near-baseline`); the NEAR version replaces its chain, wallet and backend. Built with AI coding help. Market data: CoinGecko, Nasdaq.com, ExchangeRate API. Brand marks: Simple Icons, Invesco, State Street; pUSD and paper token marks are Pocket originals. Paper money, not financial advice.
