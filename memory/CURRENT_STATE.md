# POCKET — Current State

Updated: 2026-10-13

## Product truth

- **Job:** Money plan that cannot overspend. Approved plan = only permission.
- **Surface:** ChatGPT-like consumer chat at `/app/$threadId`. Crypto under the hood.
- **Account:** Privy-primary (wired; needs `VITE_PRIVY_APP_ID` + `PRIVY_APP_SECRET`).
- **Network:** Monad testnet (10143) only.

## What is live in repo

| Area | Status |
|---|---|
| Marketing site + chat UI | Live |
| Supabase threads/messages + RLS | Live |
| Cookie httpOnly session storage (prod) | Live (`/api/auth/session`) |
| Multi-tenant schema migration | Ready (`0001_pocket_multitenant_settlement.sql`) |
| PolicyEngine + PlanParser + IntentComposer | Live + unit tests + harness 3/3 |
| `/api/settle` + BlockScreen | Live (deny path); allow path needs Privy wallet + RPC |
| Agora Instant Settlement module | Live code (testnet addresses fact-checked) |
| Envio indexer config + `/api/receipts` | Ready (needs `ENVIO_GRAPHQL_URL`) |
| ElevenLabs `/api/speak` | Ready (needs `ELEVENLABS_API_KEY`) |
| Under-hood Nansen / Mera PRF / Tenderly | Gated modules (no fake data) |
| Cursor rules + skills + memory | Live |

## Keys needed next (ask user — do not paste in chat)

1. `VITE_PRIVY_APP_ID` + `PRIVY_APP_SECRET` (+ gas sponsorship on Monad testnet)
2. `MONAD_RPC_URL`
3. Agora Instant Settlement whitelist for testnet swappers
4. `ENVIO_API_TOKEN` + deploy indexer → `ENVIO_GRAPHQL_URL`
5. `LOVABLE_API_KEY` and/or AgentRouter for chat
6. `ELEVENLABS_API_KEY`
7. `SUPABASE_SERVICE_ROLE_KEY` for Privy↔member link

## Do not

- Fake settles · Dual Dynamic+Privy login · Trading-first UI · Mainnet-only features · Unhackable claims
