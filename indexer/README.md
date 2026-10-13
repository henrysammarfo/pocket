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

**Trigger a deploy:** any push to `envio` redeploys. After it goes green:

1. Open the deployment → copy **GraphQL** URL → `ENVIO_GRAPHQL_URL`
2. Organisation → **Tokens & Packages** → create token → `ENVIO_API_TOKEN`
3. Paste both into chat (or Vercel env)

V3 notes: `config.yaml` uses `chains` (not `networks`); `envio` is pinned to `3.14.0`.

## Local

```sh
cd indexer
npm i
npx envio codegen
npx envio dev
```

Addresses verified in `memory/FACT_CHECK.md` from Agora protocol deployments.
