# Project memory
* Testnet only. Root `pocketnear.testnet`; contracts listed in `deployment/testnet.json`.
* Keys: never in git. Server keys in `.env.local` (gitignored) and `./.secrets` (outside git). Root key in `~/.near-credentials/testnet`.
* One token naming everywhere: `TSLAon`, `NVDAon`, `AAPLon`, `SPYon`, `QQQon` (paper tokens, 18 decimals). pUSD 6 decimals.
* RPC: use `https://test.rpc.fastnear.com`; `rpc.testnet.near.org` rate limits (429).
* Database is Neon (not Supabase). Never Base. Never force push.
* AI provider: Groq free tier is primary (GROQ_API_KEY; chat openai/gpt-oss-120b, voice whisper-large-v3; free limits 30 chat calls a minute, 1K a day, 8K tokens a minute; Whisper 20 a minute). NEAR AI Cloud (NEARAI_API_KEY, z-ai/glm-5.3-flash, openai/whisper-large-v3) has $0 credit; $10 free NEAR AI credits are offered at nearbuilders.org/dashboard.
* Server wide caps AI_GLOBAL_PER_MIN=25, AI_GLOBAL_PER_DAY=900, VOICE_GLOBAL_PER_MIN=18; over the cap Chat falls back to the built in helper.
* Hackathon facts (nearhackathon.com/HACKATHON.md): deadline 2026-11-14 23:59 UTC; repo public; README for AI judges with do X, see Y steps; LICENSE; X demo post by the human; hosted demo kept up to 18 Nov, ideally 25 Nov. Best tracks: realworld, security.
