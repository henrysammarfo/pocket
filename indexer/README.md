# POCKET Envio indexer

Indexes Agora Instant Settlement `Swap` events on **Monad testnet (10143)** into GraphQL entities consumed by `/api/receipts` → Activity chips.

## Envio Cloud — Connect Repository form (exact values)

| Field | Value |
|---|---|
| Connect pocket from Github | `henrysammarfo/pocket` |
| Indexer Name | `pocket` |
| Indexer Directory | `indexer` |
| Config File | `config.yaml` |
| Git Release Branch | `envio` |
| Indexer Plan | **Development** (Free) |
| Allow public visibility | optional |

Then click **Connect**.

After the first deploy succeeds, open the deployment → copy:
- GraphQL endpoint → `ENVIO_GRAPHQL_URL`
- Account → **Tokens & Packages** → create **HyperSync** / API token if needed → `ENVIO_API_TOKEN`

Paste both into chat (or Vercel env) so `/api/receipts` can merge live indexed events.

## Local

```sh
cd indexer
npm i
npx envio codegen
npx envio dev
```

Addresses verified in `memory/FACT_CHECK.md` from Agora protocol deployments.
