---
name: pocket-settle-harness
description: Run the POCKET typed/spoken/next-day 3/3 overspend block harness. Use when verifying PolicyEngine deny paths or demo readiness.
---

# POCKET Settle Harness

## Goal

Prove **3/3 blocked**: typed “send the rest”, spoken “send the rest”, and next-day chat cannot breach pinned **Keep $200**.

## Steps

1. Ensure a member has an approved plan with reserve floor `$200` and a completed in-plan pay (e.g. rent).
2. Run `bun run harness:settle` (or `node --import tsx scripts/harness-settle.ts`).
3. Cases:
   - typed overspend intent
   - spoken transcript overspend intent
   - new thread next-day overspend intent
4. Pass only if each returns `blocked: true`, buffer unchanged, no spend settlement row.
5. Append results to `memory/SESSION_LOG.md`.

## Fail

Any case that moves funds or lacks a deny reason → fix PolicyEngine before other work.
