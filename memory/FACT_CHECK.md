# POCKET — Fact Check Ledger

Format: claim → source → verdict → date

## Verified

| Claim | Source | Verdict | Date |
|---|---|---|---|
| Metropolis Consumer track $30k (3×$10k); build ~1 Sep–13 Oct 2026; winners 3 Nov | https://www.monad.xyz/metropolis | Confirmed | 2026-10-13 |
| Bankr/Grok Morse-code drain ~May 2026 ~$150–200k | Tavily + incidentdatabase.ai/cite/1556, Repello | Confirmed | 2026-10-13 |
| Monad testnet chain ID 10143; mainnet 143 | Envio docs supported-networks | Confirmed | 2026-10-13 |
| Agora Instant Settlement Monad testnet factory `0x8468587Af422ad440F58a57E955eCA6A970b5375`, CTK/AUSD pair `0x1Aa8958Aa34cEC8096EF4381cb335effe977b0ae`, whitelister `0x7c10F56d6f04a51376393a1C3670e966863F6BD5` | https://docs.agora.finance/instant-settlement/protocol-deployments.md | Confirmed | 2026-10-13 |
| AUSD Monad testnet `0xa9012a055bd4e0eDfF8Ce09f960291C09D5322dC` | https://docs.agora.finance/developer/contract-deployments.md | Confirmed | 2026-10-13 |
| Privy gas sponsorship lists Monad; EIP-7702 supported | docs.privy.io gas overview | Confirmed | 2026-10-13 |
| TinyFish REST base `https://agent.tinyfish.ai`, header `X-API-Key` | https://docs.tinyfish.ai/authentication.md | Confirmed | 2026-10-13 |
| Envio HyperIndex supports Monad testnet 10143 | docs.envio.dev HyperIndex supported-networks | Confirmed | 2026-10-13 |

## Corrections / open

| Claim | Notes |
|---|---|
| Agora Instant Settlement Sepolia factory examples in some guides | Prefer protocol-deployments.md; Monad testnet listed with same CREATE3 factory address pattern |
| `api.tinyfish.ai` | Does not resolve; use `agent.tinyfish.ai` / `api.search.tinyfish.ai` / `api.fetch.tinyfish.ai` |
| Repo previously claimed live Monad settles | Marketing only — not implemented until PolicyEngine+Agora land |
