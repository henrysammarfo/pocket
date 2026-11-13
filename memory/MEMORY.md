# Project memory
* Testnet only. Root `pocketnear.testnet`; contracts listed in `deployment/testnet.json`.
* Keys: never in git. Server keys in `.env.local` (gitignored) and `./.secrets` (outside git). Root key in `~/.near-credentials/testnet`.
* One token naming everywhere: `TSLAon`, `NVDAon`, `AAPLon`, `SPYon`, `QQQon` (paper tokens, 18 decimals). pUSD 6 decimals.
* RPC: use `https://test.rpc.fastnear.com`; `rpc.testnet.near.org` rate limits (429).
* Database is Neon (not Supabase). Never Base. Never force push.
