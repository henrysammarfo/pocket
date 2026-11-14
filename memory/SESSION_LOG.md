# Session log
* 2026-11-13: Cut `near-hackathon` from `otari-devs-wilding` (tag `near-baseline`). Removed Monad code.
* Built fixed supply NEP-141 token, vendored defuse v0.4.2 wasm, idempotent testnet bootstrap on `pocketnear.testnet`.
* Server pool: accounts, NEP-366 relayer with policy, faucet, HMAC quotes, maker settlement, limits, receipts from chain.
* App: chat with plan cards, review with hold to approve, send flow, invest, stock and coin pages, swap, wallet, receipts, settings, profile, contacts, pay links.
* Verified: `npm run judge` PASS on testnet; browser UI flow (signup, chat plan, approve, trade, receipt) passed; responsive matrix.
* 2026-11-13 late: Round 2. Chat is a real assistant (small talk, planning, `confirm_intent`, `remember`), history and memories in Neon behind a NEP-413 signed session. Voice: tap or hold mic, voice note upload, Whisper large v3 with a Ghanaian English and Pidgin prompt, no speech hallucination filter, `cleanSpeech`, browser speech fallback, spoken replies toggle. AI credits (1,000 free a month) metered from real tokens, meter and memory list in Settings. Groq is the default provider (`openai/gpt-oss-120b`, `whisper-large-v3`), NEAR AI Cloud by `AI_PROVIDER=nearai`. `npm run test:all`, smoke test, CI workflow, docs/BUSINESS.md, docs/SUBMISSION.md, docs/TESTING.md, LICENSE.
* Vercel CLI on the box is logged out, so env vars could not be pushed; `scripts/vercel-env.py` (npm run vercel:env) does it by name once a VERCEL_TOKEN exists. GitHub integration still builds previews per push.
* 2026-11-14: Vercel env set by name for production and preview (scripts/vercel-env.py). Vercel build runs unit tests first. PR #3 merged; production https://pocket-teamtitanlink.vercel.app (alias also pocket-zeta-lime.vercel.app). Hosted smoke 17/17 PASS; hosted journey phone and desktop 13/13 PASS each. Actions off (billing), report in docs/TEST_REPORT.md.
* 2026-11-14: Demo video built from the live site (scripts/video, `npm run video`): 1920x1080 H.264, 97.96 s, edge-tts voiceover, captions, zooms on plan, voice and receipt, no music; poster docs/shots/poster.png. Added tests/attack.mjs (`npm run attack`, 7 refused attacks). Fixed: faucet now serves Pocket accounts only (it had sent pUSD to evil.testnet); malformed relayer keys give 400 not 500. README gained a no setup verify section, criteria to evidence table, tracks and security notes; SUBMISSION.md has every form field with Henry's email and payout account.

## 2026-11-14 private AI on NEAR AI Cloud (branch private-ai-nearai)
- New src/lib/server/llm.ts: provider chain NEAR AI Cloud first (Qwen/Qwen3.6-35B-A3B-FP8 chat with tools, Qwen/Qwen3-VL-30B-A3B-Instruct photos, openai/whisper-large-v3 voice, all TEE), Groq fallback on errors, 429 or daily cap.
- Daily NEAR AI cap NEARAI_USD_PER_DAY (default 0.8) counted in store key nearai:usd:YYYY-MM-DD; every call logs {ai, model, tin, tout, usd} (no content). About $0.0004 per chat.
- Web search stays on Groq browser_search (web.ts uses groq explicitly). verify:tee checks all three models. Settings shows "Private AI on NEAR AI Cloud (TEE)". SUBMISSION adds track privacy.
- Local: smoke, attack, chat-voice, chat-abilities ALL PASS on NEAR AI; with a bad NEAR AI key chat-voice ALL PASS through Groq fallback.
- Vercel env set by name for production and preview: AI_PROVIDER=nearai, NEARAI_API_KEY.
