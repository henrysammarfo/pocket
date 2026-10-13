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
