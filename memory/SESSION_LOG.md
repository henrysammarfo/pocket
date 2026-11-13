# Session log
* 2026-11-13: Cut `near-hackathon` from `otari-devs-wilding` (tag `near-baseline`). Removed Monad code.
* Built fixed supply NEP-141 token, vendored defuse v0.4.2 wasm, idempotent testnet bootstrap on `pocketnear.testnet`.
* Server pool: accounts, NEP-366 relayer with policy, faucet, HMAC quotes, maker settlement, limits, receipts from chain.
* App: chat with plan cards, review with hold to approve, send flow, invest, stock and coin pages, swap, wallet, receipts, settings, profile, contacts, pay links.
* Verified: `npm run judge` PASS on testnet; browser UI flow (signup, chat plan, approve, trade, receipt) passed; responsive matrix.
* 2026-11-13 late: Round 2. Chat is a real assistant (small talk, planning, `confirm_intent`, `remember`), history and memories in Neon behind a NEP-413 signed session. Voice: tap or hold mic, voice note upload, Whisper large v3 with a Ghanaian English and Pidgin prompt, no speech hallucination filter, `cleanSpeech`, browser speech fallback, spoken replies toggle. AI credits (1,000 free a month) metered from real tokens, meter and memory list in Settings. Groq is the default provider (`openai/gpt-oss-120b`, `whisper-large-v3`), NEAR AI Cloud by `AI_PROVIDER=nearai`. `npm run test:all`, smoke test, CI workflow, docs/BUSINESS.md, docs/SUBMISSION.md, docs/TESTING.md, LICENSE.
* Vercel CLI on the box is logged out, so env vars could not be pushed; `scripts/vercel-env.sh` does it by name once a VERCEL_TOKEN exists. GitHub integration still builds previews per push.
