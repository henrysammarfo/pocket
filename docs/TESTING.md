# Testing

One command runs everything: `npm run test:all`. It writes `test-results/summary.md`, one log per step, the server log and screenshots.

## Clean state, every run
- `test-results/` is deleted and recreated, so logs start empty.
- `.next` is deleted and the app is built fresh, then started on its own port (3210).
- Every browser test opens a brand new Playwright context: no cookies, no local storage, no saved session.
- Every test signs up a brand new testnet account with a new random username (`e2e…`, `cv…`, `rsp…`, `ftm…`), so no run depends on an earlier one.
- Steps that need testnet keys are marked SKIP, not FAIL, when `.env.local` has none (for example in CI without secrets).

## The plan
| Layer | What it checks | Command |
| --- | --- | --- |
| Lint and types | ESLint, TypeScript strict | `npm run lint`, `npm run typecheck` |
| Unit | NEP-413 sign and verify (and a tampered message fails), intent payloads, units, address rules, plan rules (keep, limit, trade cap), messy speech cleanup on real Whisper output | `npm test` |
| Smoke (local and hosted) | Pages, stylesheet, chain health, live prices, and that credits, memory, history and voice refuse callers without a signed session | `npm run smoke -- <url>` |
| Integration on testnet | Sign up, faucet, gasless pUSD intent, NEP-366 USDC and NEAR sends, daily limit, paper buy and sell through the NEAR Intents verifier, receipts | `npm run judge` |
| Browser e2e, money | Phone size: sign up, chat plan, hold to approve, send and buy settle, wallet, stock page, buy sheet, receipt, every page | `npm run e2e` |
| Browser e2e, chat and voice | Phone (390x844) and desktop (1440x900): small talk, messy typed request, confirm step, plan card, mic record and stop with a fake microphone, a real messy voice note (West African accent, fillers, repeats, Pidgin) transcribed by Whisper and confirmed back, memory saved and shown in Settings, credits metered, no overflow, no page errors | `npm run e2e:chat` |
| Responsive | 16 routes x widths 320, 375, 414, 768, 1024, 1440 x zoom 100, 75, 50% x light and black: no horizontal overflow, at most 5 tabs | `npm run e2e:responsive` |
| CI | Same `npm run test:all` on GitHub Actions, results uploaded as an artifact | `.github/workflows/test.yml` |

## Results
Run on the box, 13 Nov 2026 (Africa/Accra, UTC+0), Groq on (`openai/gpt-oss-120b`, `whisper-large-v3`), Neon off locally (in memory store), testnet keys on.

Final clean run, `SMOKE_URL=https://pocket-2cmwsja7v-teamtitanlink.vercel.app npm run test:all`, finished 13 Nov 2026 23:57 (Africa/Accra, UTC+0): **all 11 steps PASS**.

| Step | Result | Last line | Time |
| --- | --- | --- | --- |
| lint | PASS |  | 2.1 s |
| typecheck | PASS |  | 1.5 s |
| unit | PASS |    Duration  180ms (tests 44%, import 34%, transform 17%, worker 5%) | 0.6 s |
| build | PASS | ƒ  (Dynamic)  server-rendered on demand | 18.5 s |
| smoke local | PASS | ALL PASS | 1.1 s |
| integration testnet (judge) | PASS | PASS: Pocket works end to end on NEAR testnet for ftmwflz3uo.pocketnear.testnet | 23.3 s |
| e2e money flow phone | PASS | UI FLOW PASS | 72.9 s |
| e2e chat and voice phone | PASS | ALL PASS | 25.9 s |
| e2e chat and voice desktop | PASS | ALL PASS | 25.9 s |
| responsive matrix | PASS | checked 448 page views, 0 with overflow | 1530.7 s |
| smoke hosted | PASS | ALL PASS | 0.5 s |

What the chat and voice run showed:
- Small talk: "hi, how are you today?" got "Hey Kofi! I'm doing great, thanks for asking. How's your day going?"
- Voice note heard as "E H M. So I want to, like, send send at admin or $5, and put 10 in tesla abeg." Pocket answered "You want to send $5 to @admin and buy $10 of Tesla stock, correct?" with Yes and No buttons, then made the plan.
- "I get paid on the 25th, please remember that" was saved and shown under What Pocket remembers.
- A fake microphone tone produced no words, and Pocket did not make anything up from it (Whisper no speech segments are dropped).

Hosted preview smoke test (https://pocket-2cmwsja7v-teamtitanlink.vercel.app): pages, CSS, chain health, prices and session checks all PASS. The preview runs read only because its Vercel project has no server keys or AI key yet (see the report).

## Earlier issues found by these tests and fixed
- Whisper turned a non speech tone into "you", and the model then guessed a send from the chat context. Fixed by dropping segments Whisper marks as no speech, plus a short list of known hallucinations.
- The model asked for a confirmation on clear typed requests, which broke the money flow test. Typed requests with a clear person, amount and asset now go straight to a plan card; voice always confirms.
- The welcome page showed overflow when an old build was served; the runner now always deletes `.next` and builds fresh.
