<p align="center"><img src="public/brand/coil.svg" width="64" alt="Pocket" /></p>

# Pocket: talk to your money, on NEAR testnet

**The problem:** sending money abroad, buying a stock or holding dollars still means five apps, fees you only see later, and screens that assume you already know finance. AI can help, but nobody should give an AI their keys.

**Pocket** is a chat first money assistant. Say *"Send Mum 50 dollars and put 25 in Tesla"*. Pocket turns it into a plan card, checks it against your rules in code, and nothing moves until you **hold to approve** on your own device. Sends are gasless, trades settle in one atomic call to the **NEAR Intents verifier**, and every move gets a public receipt rebuilt from the chain.

**Testnet only. No mainnet, no real money.** Test dollars (pUSD), Circle testnet USDC, and paper stock tokens (TSLAon, NVDAon, AAPLon, SPYon, QQQon) priced live.

## One command setup
Needs Node 20+, [near CLI](https://github.com/near/near-cli-rs) and [cargo-near](https://github.com/near/cargo-near) (only to build the token wasm).
```bash
npm ci
npm run setup    # creates a testnet root with the faucet, deploys verifier + tokens, writes .env.local
npm run judge    # end to end on testnet, prints PASS with NearBlocks links
npm run dev      # open http://localhost:3000
```
Optional: add a free `GROQ_API_KEY` from console.groq.com to `.env.local` for AI chat and voice. Without it everything still works with the built in helper and browser speech.
Have a funded testnet account already? `ROOT=you.testnet npm run setup` (key in `~/.near-credentials/testnet`). AI agents: see [AGENTS.md](AGENTS.md).

## Try it in five steps (do X, see Y)
| Do | See |
| --- | --- |
| 1. Open the app, pick a username, tap **Create my Pocket** | A real account `name.pocketnear.testnet` is created for you, gas paid by Pocket. You land in Chat |
| 2. Wallet, tap **Get test dollars** | 1,000 pUSD arrive from the faucet, with a NearBlocks link |
| 3. In Chat type or say *"ehm send send @admin like five dollars and put 10 in Tesla"* | Pocket cleans up the messy speech, confirms what it heard, and shows one plan card with two steps checked against your rules |
| 4. **Review and approve**, then press and hold the button for 1.2 s | The send and the TSLAon buy settle on testnet, gas paid by the relayer |
| 5. Open the receipt | A public page rebuilt from the chain: signed intents, price, spread and source |

Settings shows your **AI credits meter** and **what Pocket remembers** about you (you can forget any item). Everything above is covered by `npm run test:all`.

## What works end to end (live on NEAR testnet)
| Feature | How |
| --- | --- |
| Sign up with a username | Browser makes an ed25519 key; sponsor creates `name.root.testnet` with 0.05 NEAR |
| Gasless sends of pUSD, USDC, NEAR | pUSD: NEP-413 signed `transfer` intent, relayed `execute_intents`. USDC and NEAR: NEP-366 delegate actions paid by the relayer |
| Send by saved name, `@username`, `.testnet` account, NEAR 0x account or pay link `/pay/name` | `src/lib/shared/address.ts`, never guesses a network |
| Chat that talks about anything | Small talk, money questions and planning through any OpenAI compatible API: Groq free tier (`openai/gpt-oss-120b`) by default, NEAR AI Cloud (private TEE models) with one env var. Tool calls `propose_plan`, `confirm_intent`, `remember`. The AI never signs; money only moves through plan cards. With no key, a built in helper still reads money commands |
| Voice | Tap or hold the mic, or attach a voice note (m4a, mp3, ogg, opus, wav, webm). Whisper large v3 transcribes with a prompt tuned for Ghanaian English and Pidgin; `src/lib/shared/speech.ts` strips fillers, stutters and repeats; Pocket says back what it understood before the plan. Falls back to the browser's own speech recognition with no key. Optional spoken replies in Settings |
| Memory | Preferences and past chats per account in Neon Postgres, behind a NEP-413 signed session. Never stores keys or passwords |
| AI credits | 1,000 free a month per account, metered on the server from real token use, refunded on failure. Server wide caps keep it inside the free tier. See [docs/BUSINESS.md](docs/BUSINESS.md) |
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
`npm run test:all` runs everything from a clean state: lint, types, unit, a fresh build, a local smoke test, the testnet flow (`npm run judge`), real browser runs on phone and desktop with fresh profiles and fresh accounts, the responsive matrix (16 routes, 320 to 1440 px, 50 to 100% zoom, light and black), and a hosted smoke test with `SMOKE_URL=...`. Results: [docs/TESTING.md](docs/TESTING.md). CI: `.github/workflows/test.yml`.

## More
[docs/BUSINESS.md](docs/BUSINESS.md) how Pocket makes money and meters AI. [docs/SUBMISSION.md](docs/SUBMISSION.md) submission text and demo script. [SECURITY.md](SECURITY.md) threat model. [AGENTS.md](AGENTS.md) for AI judges.

## Disclosure
Built for the NEAR hackathon on top of an earlier Pocket prototype (branch `otari-devs-wilding`, tagged `near-baseline`); the NEAR version replaces its chain, wallet and backend. Built with AI coding help. Market data: CoinGecko, Nasdaq.com, ExchangeRate API. Brand marks: Simple Icons, Invesco, State Street; pUSD and paper token marks are Pocket originals. Paper money, not financial advice.
