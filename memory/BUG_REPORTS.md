# POCKET — Integration Bug Reports

Real SDK/API/docs issues found while building. Not style nits.

## Open / filed

| ID | Component | Severity | Notes |
|---|---|---|---|
| BR-001 | `@privy-io/server-auth` | Low | npm installs with deprecation warning; Privy directs to `@privy-io/node`. POCKET uses `@privy-io/node` for server wallet/auth. |
| BR-002 | TinyFish DNS | Medium | `api.tinyfish.ai` does not resolve. Correct hosts: `agent.tinyfish.ai`, `api.search.tinyfish.ai`, `api.fetch.tinyfish.ai` (docs.tinyfish.ai). |
| BR-003 | Envio HyperIndex config | Info | Some docs use `chains:` vs `networks:` keys depending on version — verify against installed `envio` CLI before cloud deploy. |

## Template

- Repro steps
- Expected vs actual
- Environment (Monad testnet 10143, SDK versions)
- Upstream link / commit
- Novel workaround (if any) + whether we upstreamed it
