# POCKET Envio indexer

Indexes Agora Instant Settlement `Swap` events on **Monad testnet (10143)** into GraphQL entities consumed by `/api/receipts` → Activity chips.

## Setup

1. Claim Envio free API token / Metropolis Cloud hosting.
2. Set `ENVIO_API_TOKEN` and `ENVIO_GRAPHQL_URL` in app `.env`.
3. From this folder: `npm i && npx envio codegen && npx envio dev` (or deploy to Envio Cloud).

Addresses verified in `memory/FACT_CHECK.md` from Agora protocol deployments.
