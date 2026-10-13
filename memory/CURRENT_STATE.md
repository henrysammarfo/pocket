# POCKET — Current State

Updated: 2026-10-13

## Product truth

- **Job:** Money plan that cannot overspend. Approved plan = only permission.
- **Surface:** ChatGPT-like consumer chat at `/app/$threadId`. Crypto under the hood.
- **Account:** Privy-primary — App ID wired locally + Vercel (finish dashboard Monad/domain settings).
- **Data plane:** Neon `pocket-db` — schema live.
- **AI:** AgentRouter key wired (HTTP 200 to `/v1/models`).
- **Voice:** ElevenLabs key wired (needs voice ID optional).
- **Network:** Monad testnet RPC `https://testnet-rpc.monad.xyz`.

## Wired secrets (names only — never in git)

| Secret | Status |
|---|---|
| `DATABASE_URL` | Live (Neon) |
| `VITE_PRIVY_APP_ID` / `PRIVY_APP_ID` / `PRIVY_APP_SECRET` | Live local + Vercel |
| `AGENTROUTER_API_KEY` | Live local + Vercel |
| `ELEVENLABS_API_KEY` | Live local + Vercel |
| `MONAD_RPC_URL` | Live (`testnet-rpc.monad.xyz`) |
| `ENVIO_GRAPHQL_URL` / `ENVIO_API_TOKEN` | Waiting — Connect form in progress |

## Envio Connect form (exact)

- Indexer Directory: `indexer`
- Config File: `config.yaml`
- Git Release Branch: `envio` (branch pushed)
- Plan: Development (Free)

## Privy dashboard still needed

1. Login methods: Email + Google
2. Embedded wallets on login
3. Add Monad Testnet chain id `10143`, RPC `https://testnet-rpc.monad.xyz`
4. Enable gas sponsorship for Monad testnet
5. Allowed domains: Vercel preview/production URLs + `http://localhost:3000`

## Do not

- Fake settles · Reintroduce Lovable/Supabase · Commit secrets · Unhackable claims
