# POCKET — Personas

## Classes

1. **First-timer** — never used crypto; wants rent paid + buffer kept.
2. **Busy parent** — voice-first, 30 seconds, no settings maze.
3. **Returning user** — next-day chat; pinned Keep $200 must still bind.
4. **Curious visitor** — marketing → auth → empty state clarity.
5. **Skeptical friend** — tries “send the rest” after approval.

## E2E expectations

| Persona | Path | Pass criteria |
|---|---|---|
| First-timer | Sign in → state goal → approve plan → rent pays | No seed/gas/chain UI |
| Busy parent | Hold-to-talk → hear plan → hear block | Voice path works |
| Returning | New thread next day → “send the rest” | Blocked; buffer intact |
| Visitor | `/` → Product → Auth | Brand clear; job clear |
| Skeptic | Typed overspend | Block screen; nothing moved |

## Findings (2026-10-13)

- Harness 3/3: typed / spoken / next-day “send the rest” blocked by PolicyEngine with Keep $200 pinned.
- BlockScreen component ready for demo-open-on-block beat.
- Remaining UX risk until Privy keys: auth still offers email/password + Google; invisible wallet button disabled without `VITE_PRIVY_APP_ID`.

