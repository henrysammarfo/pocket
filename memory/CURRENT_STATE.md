# POCKET — Current State

Updated: 2026-10-13

## Product truth

- **Job:** Money plan that cannot overspend. Approved plan = only permission.
- **Surface:** ChatGPT-like consumer chat at `/app/$threadId`. Crypto under the hood.
- **Account:** Privy-primary (target). Supabase Auth currently powers chat.
- **Network:** Monad testnet (10143) only.

## What is live in repo

| Area | Status |
|---|---|
| Marketing site + chat UI | Live (TanStack Start) |
| Supabase threads/messages + RLS | Live |
| AI chat via Lovable gateway | Live when `LOVABLE_API_KEY` set |
| Voice transcribe route | Live when gateway key set |
| Privy embedded wallet | Building |
| PolicyEngine / IntentComposer | Building |
| Agora Instant Settlement exec | Building |
| Envio indexer → Activity | Building |
| Cookie/httpOnly session (no localStorage auth) | Building |
| Multi-tenant households | Building |

## Keys needed next

1. `VITE_PRIVY_APP_ID` + `PRIVY_APP_SECRET`
2. `MONAD_RPC_URL`
3. Agora whitelist / API for Instant Settlement swappers
4. `ENVIO_API_TOKEN`
5. `LOVABLE_API_KEY` and/or AgentRouter for chat
6. `ELEVENLABS_API_KEY` for speak-back

Research keys (Tavily, TinyFish, AgentRouter) are wired in local `.env` (gitignored).

## Do not

- Fake settles · Dual Dynamic+Privy login · Trading-first UI · Mainnet-only features · Unhackable claims
