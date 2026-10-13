# POCKET — Current State

Updated: 2026-10-13

## Product truth

- **Job:** Money plan that cannot overspend. Approved plan = only permission.
- **Surface:** ChatGPT-like consumer chat at `/app/$threadId`. Crypto under the hood.
- **Account:** Privy-primary (needs `VITE_PRIVY_APP_ID` + `PRIVY_APP_SECRET`).
- **Data plane:** Neon Postgres via Drizzle (Vercel project `pocket`).
- **AI:** AgentRouter OpenAI-compatible (`AGENTROUTER_API_KEY`).
- **Network:** Monad testnet (10143) only.

## What is live in repo

| Area | Status |
|---|---|
| Marketing site + chat UI | Live |
| Lovable / Supabase auth & AI gateway | **Removed** |
| Neon schema + Drizzle client | Ready (`0002_neon_privy_schema.sql`) — needs `DATABASE_URL` |
| Privy session → Neon member link | Live (`/api/auth/privy-link`) |
| Threads API (list/create/delete/messages) | Live (`/api/threads`) |
| PolicyEngine + PlanParser + IntentComposer | Live + unit tests + harness 3/3 |
| `/api/settle` + BlockScreen | Live (deny path); allow path needs Privy wallet + RPC |
| Agora Instant Settlement module | Live code (testnet addresses fact-checked) |
| Envio indexer config + `/api/receipts` | Ready (needs `ENVIO_GRAPHQL_URL`) |
| ElevenLabs `/api/speak` | Ready (needs `ELEVENLABS_API_KEY`) |
| Cursor rules + skills + memory | Live |
| Key acquisition guide | `memory/KEYS_GUIDE.md` |

## Keys needed next

Follow click-path in `memory/KEYS_GUIDE.md`:

1. `DATABASE_URL` — Neon via Vercel Storage on project **pocket**
2. `VITE_PRIVY_APP_ID` + `PRIVY_APP_ID` + `PRIVY_APP_SECRET` (+ Monad testnet + gas sponsorship)
3. `AGENTROUTER_API_KEY` (base URL already known)
4. `MONAD_RPC_URL` (public testnet RPC OK to start)
5. `ENVIO_API_TOKEN` + `ENVIO_GRAPHQL_URL`
6. `ELEVENLABS_API_KEY` (optional TTS)

## Do not

- Fake settles · Dual login stacks · Trading-first UI · Mainnet-only features · Unhackable claims · Reintroduce Lovable/Supabase
