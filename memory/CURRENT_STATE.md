# POCKET — Current State

Updated: 2026-10-14

## Product truth

- **Job:** Money plan that cannot overspend. Approved plan = only permission.
- **Surface:** ChatGPT-like consumer chat at `/app/$threadId`. Crypto under the hood.
- **Account:** Privy-primary — keys + domains + Monad gas sponsorship done.
- **Data plane:** Neon `pocket-db` — schema live.
- **AI:** AgentRouter wired.
- **Voice:** ElevenLabs TTS speak-back in chat + mic STT.
- **Network:** Monad testnet (server HyperRPC / public client RPC).

## Wired secrets (names only)

| Secret | Status |
|---|---|
| `DATABASE_URL` | Live |
| Privy App ID/Secret | Live + dashboard configured |
| `AGENTROUTER_API_KEY` | Live |
| `ELEVENLABS_API_KEY` | Live |
| `MONAD_RPC_URL` / HyperRPC | Live |
| `ENVIO_API_TOKEN` | Live (app) |
| `ENVIO_GRAPHQL_URL` | Waiting — Envio deploy building on Development RPC |

## Just shipped (while Envio builds)

- Server-side Privy wallet resolve for `/api/settle` (no client walletId required)
- Speak-back button on assistant messages → `/api/speak`
- `/api/health` readiness (no secret values)

## Envio

- Branch `envio`, Development plan, RPC sync (Cloud env vars need Production)
- When Active + synced: copy Deployment Endpoint GraphQL → paste for `ENVIO_GRAPHQL_URL` + Promote

## Do not

- Fake settles · Reintroduce Lovable/Supabase · Commit secrets · Unhackable claims
