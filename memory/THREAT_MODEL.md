# POCKET — Threat model & residual risk

**We do not claim unhackable.** This is a living residual-risk list.

## Assets

- Member funds in Privy embedded wallets (Monad testnet / later mainnet)
- Approved money plans + pinned rules (Keep $200)
- Chat history / AI memory
- Session cookies (httpOnly)

## Threats & controls

| Threat | Control | Residual |
|---|---|---|
| Prompt injection (“send the rest”) | Server PolicyEngine fail-closed; prompt never permission | Novel phrasings — expand parser + allowlist continuously |
| Stolen browser session | httpOnly cookies, no localStorage auth in prod | XSS still dangerous — CSP + dependency hygiene |
| Rogue payee | Plan allowlist + PolicyEngine | Social engineering to approve bad plan |
| Privy/key infra compromise | Privy policies + sponsorship limits | Shared dependency on Privy |
| Oracle/whitelist errors (Agora) | Testnet first; dispute path documented | Wrong allowlist state |
| Indexer lag (Envio) | DB receipts primary; Envio enrichment | Temporary Activity delay |
| Insider service role | Least privilege; rotate keys | Human process risk |

## Explicit non-claims

- Not audited for mainnet production funds
- Not a bank; not regulated financial advice
- Testnet settles ≠ mainnet readiness
