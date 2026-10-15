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

**Development plan note:** Envio Cloud **Environment Variables** require a Production plan.  
On Development we index via public Monad RPC (`config.yaml` `rpc.for: sync`) from a near-head `start_block` — no Cloud env vars needed.

**After deploy is Active + syncing:**

1. Open deployment → copy **Deployment Endpoint** (GraphQL) → paste as `ENVIO_GRAPHQL_URL`  
2. Click **Promote** for a stable production endpoint  
3. App still uses your HyperSync token in **Vercel** (`ENVIO_API_TOKEN`) for `/api/receipts` auth if the GraphQL endpoint requires it

Optional later: upgrade Envio plan → set Cloud `ENVIO_API_TOKEN` → remove `rpc.for: sync` to use HyperSync.

V3 notes: `config.yaml` uses `chains`; `envio` is pinned to `3.14.0`.

## Local

```sh
cd indexer
npm i
npx envio codegen
npx envio dev
```

Addresses verified in `memory/FACT_CHECK.md` from Agora protocol deployments.
