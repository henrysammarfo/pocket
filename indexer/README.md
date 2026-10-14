# POCKET Envio indexer

Indexes Agora Instant Settlement `Swap` events on **Monad testnet (10143)** into GraphQL entities consumed by `/api/receipts` → Activity chips.

## Envio Cloud — your indexer is connected

Settings that must match (you already have these):

| Field | Value |
|---|---|
| Repository | `pocket` |
| Active branch | `envio` |
| Root directory | `indexer` |
| Plan | Development |

**HyperSync token (required on Envio Cloud for V3):**

1. Organisation → **Tokens & Packages** → **HyperSync Tokens** → create/copy token  
2. Envio Cloud → **Projects** → **pocket** → **Settings** (or Environment Variables)  
3. Add: `ENVIO_API_TOKEN` = that HyperSync token  
4. Redeploy / wait for next Active deployment — **Source** should show **HyperSync**, not RPC  

**After sync is healthy:**

1. Open deployment → copy **Deployment Endpoint** (GraphQL) → `ENVIO_GRAPHQL_URL`  
2. Click **Promote** so production endpoint stays stable  
3. Paste GraphQL URL into chat (also keep HyperSync token in Vercel for the app)

V3 notes: `config.yaml` uses `chains`; `envio` is pinned to `3.14.0`.

## Local

```sh
cd indexer
npm i
npx envio codegen
npx envio dev
```

Addresses verified in `memory/FACT_CHECK.md` from Agora protocol deployments.
