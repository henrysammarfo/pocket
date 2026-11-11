# POCKET — Session Log

## 2026-10-13 — Phase 0 kickoff

- Locked plan: Privy-primary, Consumer track, Monad testnet, ChatGPT surface.
- Created `.cursor/rules/*`, `.cursor/skills/*`, memory base, `POCKET_BIBLE.md`.
- `.env` untracked + gitignored; `.env.example` names-only.

## 2026-10-13 — Phases 1–6 implemented

- Cookie sessions, Privy provider/bridge/link, multi-tenant SQL + types.
- PolicyEngine/PlanParser/IntentComposer; `/api/settle`, `/api/plans/approve`, BlockScreen.
- Agora + Privy exec modules; Envio indexer scaffold + `/api/receipts`.
- ElevenLabs `/api/speak`; harness 3/3 PASS; vitest 4/4; `tsc` clean.
- Under-hood Nansen/Mera PRF/Tenderly gated; GTM + threat model docs.
- Waiting on Privy/RPC/Envio/ElevenLabs keys for end-to-end live pays.

## 2026-10-13 — Purge Lovable → Neon + Privy + AgentRouter

- Removed all Lovable packages, integrations, AI gateway, OAuth, error reporting, `.lovable/`, AGENTS/README Lovable blocks.
- Created Vercel project `pocket`; wired Drizzle + `@neondatabase/serverless` (lazy `getDb()`).
- Neon schema `0002_neon_privy_schema.sql` (Privy member ids, no Supabase auth.uid/RLS).
- Auth/data plane: Privy bearer → Neon members/households/threads/plans/settlements.
- Chat + transcribe → AgentRouter; Vite config is stock TanStack Start + Nitro (no Lovable vite package).
- Page-by-page key guide: `memory/KEYS_GUIDE.md`.
- Blocked on user Marketplace click for Neon `DATABASE_URL` + Privy/AgentRouter secrets.


## 2026-10-13 — Neon provisioned with Vercel token

- Provisioned Marketplace Neon resource `pocket-db` (`store_LtXiM2qzkXRjCreY`) on team `teamtitanlink`.
- Connected to project `pocket` for production/preview/development; env pulled to `.env.local`.
- Applied `0002_neon_privy_schema.sql` — tables: households, members, household_members, threads, thread_messages, money_plans, plan_rules, intents, settlements, receipts.
- Ask user to rotate the Vercel token shared in chat.

## 2026-10-13 — Keys wired (Privy / AgentRouter / ElevenLabs / Monad)

- Stored secrets in gitignored `.env` + Vercel project pocket (sensitive/encrypted).
- `privyConfigured() === true`; AgentRouter `/v1/models` HTTP 200.
- Pushed `envio` branch for Envio Cloud default release branch.
- Waiting on Envio Connect (directory must be `indexer`) + Privy dashboard Monad/domain settings.

## 2026-10-13 — Envio Cloud deploy trigger

- Fixed indexer for Envio Cloud V3: `networks`→`chains`, pin `envio@3.14.0`, `indexer.onEvent` handlers.
- Pushed to `envio` branch to trigger hosted deployment.
- Privy: guide user to enable Email + Google + Ethereum embedded wallets.

## 2026-10-14 — Approve→block demo beat

- planId sessionStorage per thread; approve returns id for same-tick settle (race fix).
- BlockScreen auto-speaks tagline via `/api/speak`.
- Quiet HealthDot in app chrome from `/api/health`.
- Production alias `pocket-zeta-lime.vercel.app` → `dpl_4cCSNxazv8NDL1HJsyqqjb8xKXdU` (health ok; envioGraphql still false).

## 2026-11-11 — Pocket on Otari (branch otari-devs-wilding)

- All AI moved to Otari (first commit f0c1e1b). Client, header parsing, error mapping in `src/lib/ai/otari`.
- Roles: intent (`pocket-intent`, strict JSON, checked against text), explainer (`pocket-explain`, streamed, web fetch + code execution + wallet MCP), safety classifier (`pocket-guard` workspace).
- Guard service `/api/guard/validate` + `/profiles` (Otari contract); wallet MCP `/api/mcp` read only, member HMAC tokens, 5 min.
- Allowance from Otari end-user routes; `ai_requests` table (migration 0003, not yet applied to Neon).
- Fallback drill via `pocket-intent-drill`. Output screening in code (Otari enforces input guardrails only).
- UI: minimal typed components (AiReceiptStrip, AiNotice, AllowanceCard, AiActivityList, DrillCard) and `/states/otari`; visual ownership moved to Hack Designer.
- Vercel previews of this branch are BLOCKED (account configuration: commit author henrysammarfo@gmail.com not linked to the Vercel team member).
- Voice input off on this branch (no open speech-to-text model in Otari's catalog).
