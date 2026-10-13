# POCKET — Current State

Updated: 2026-10-13

## Product truth

- **Job:** Money plan that cannot overspend. Approved plan = only permission.
- **Surface:** ChatGPT-like consumer chat at `/app/$threadId`. Crypto under the hood.
- **Account:** Privy-primary (needs `VITE_PRIVY_APP_ID` + `PRIVY_APP_SECRET`).
- **Data plane:** Neon Postgres via Drizzle — **LIVE** (`pocket-db` on Vercel project `pocket`).
- **AI:** AgentRouter OpenAI-compatible (`AGENTROUTER_API_KEY`).
- **Network:** Monad testnet (10143) only.

## What is live in repo

| Area | Status |
|---|---|
| Marketing site + chat UI | Live |
| Lovable / Supabase | **Removed** |
| Neon `pocket-db` + schema `0002` | **Live** (tables created) |
| Privy session → Neon member link | Live (`/api/auth/privy-link`) |
| Threads API | Live |
| PolicyEngine + settle deny path | Live + tests |
| Agora / Envio / ElevenLabs | Code ready; need remaining keys |
| Key guide | `memory/KEYS_GUIDE.md` |

## Keys still needed

1. `VITE_PRIVY_APP_ID` + `PRIVY_APP_ID` + `PRIVY_APP_SECRET` (+ Monad testnet + gas sponsorship)
2. Confirm `AGENTROUTER_API_KEY`
3. Optional: `ENVIO_*`, `ELEVENLABS_*`, custom `MONAD_RPC_URL`

## Do not

- Fake settles · Dual login stacks · Trading-first UI · Mainnet-only features · Unhackable claims · Reintroduce Lovable/Supabase · Commit `.env` / tokens
