# Vercel environment variables for the Otari branch

Names only. Values live in Vercel (project `pocket`), never in git.

## Needed by Pocket on Otari

| Name | What it is | Status |
|---|---|---|
| `OTARI_SERVICE_KEY` | Otari service key from the `pocket` workspace | to set |
| `OTARI_GUARD_KEY` | Ordinary API key from the separate `pocket-guard` workspace | to set |
| `OTARI_BASE_URL` | `https://api.otari.ai/api/v1` (code default) | optional |
| `OTARI_INTENT_MODEL` | `pocket-intent` (code default) | optional |
| `OTARI_EXPLAIN_MODEL` | `pocket-explain` (code default) | optional |
| `OTARI_GUARD_MODEL` | `pocket-guard` (code default) | optional |
| `OTARI_DRILL_MODEL` | `pocket-intent-drill` (code default) | optional |
| `OTARI_EXPLAIN_LIGHT_MODEL` | `gpt-oss-120b` (code default) | optional |
| `POCKET_PUBLIC_ORIGIN` | https origin of the deployment, so Otari can reach `/api/mcp` | to set |
| `POCKET_GUARD_TOKEN` | Random; the guardrail mandate's credential | set (sensitive) |
| `POCKET_MCP_SIGNING_SECRET` | Random; signs wallet MCP tokens | set (sensitive) |
| `POCKET_VOICE_INPUT` | `off` on this branch (code default) | optional |
| `VITE_POCKET_STATES` | `on` to serve `/states/otari` on a deployed build | optional |

## Already on the project and still used

`DATABASE_URL`, `DATABASE_URL_UNPOOLED` (Neon), `PRIVY_APP_ID`, `VITE_PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `MONAD_RPC_URL`, `VITE_MONAD_RPC_URL`, `MONAD_CHAIN_ID`, `MONAD_NETWORK`, `AUSD_TESTNET`, `AGORA_*`, `ENVIO_*`, `ELEVENLABS_API_KEY`.

## No longer read on this branch

`AGENTROUTER_API_KEY`, `AGENTROUTER_BASE_URL`, `AGENTROUTER_MODEL`, `AGENTROUTER_TRANSCRIBE_MODEL`. Leave them for `main`.
