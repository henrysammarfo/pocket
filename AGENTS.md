## Architecture rules
- The signed-in product is a threaded chat assistant at /app/$threadId; /dashboard redirects there. Why: POCKET is a conversational consumer app.
- Auth is Privy-primary (embedded wallets on Monad testnet). API routes verify the Privy bearer token and resolve a Neon `members` row.
- AI streaming and voice transcription live in server routes (`src/routes/api/chat.ts`, `api/transcribe.ts`) via AgentRouter. Why: keeps the AI key server-side and data per-member.
- Chat history and money plans are stored in Neon Postgres (Drizzle) with app-enforced member scoping. Why: conversations sync across devices.
- Settlement is fail-closed: PolicyEngine must allow before any Agora/Privy spend. "Send the rest" preserves the pinned reserve floor.
