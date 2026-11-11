# Pocket

**Tell Pocket what you want your money to do. It can never do more than you approved.**

Pocket is a chat money assistant. You describe a goal in plain words ("Pay my rent on Friday, keep $500"), Pocket turns it into a plan, and you approve it. From then on, the approved plan is the only permission: a deterministic policy engine checks every payment against it, and anything outside it, like "send the rest", is blocked with nothing moved.

This branch, `otari-devs-wilding`, runs all of Pocket's AI through [Otari](https://otari.ai), Mozilla.ai's open-source AI gateway, on open-weight models only. See [OTARI.md](OTARI.md) for every Otari feature, the file that uses it, and how to check it.

## The problem

AI assistants that touch money are trusted with too much. One persuasive message, a poisoned memo or a model mistake, and the assistant moves money it should not. And when the AI runs out of credit or goes down, the app often stops working altogether.

## Who it is for

People who want help planning money, paying regular bills and keeping a safety buffer, without handing an AI the keys.

## What Pocket does

- **Plans in chat.** Describe a goal; get a short plan with steps, amounts and dates.
- **One permission.** Approve the plan once. The policy engine in `src/lib/policy` allows only what the plan allows.
- **The Keep.** A protected amount that can never be spent, whatever anyone types.
- **Receipts for everything.** Payments, blocks, and now every AI answer: which open model replied, whether a backup model stepped in, which tools ran, and whether Pocket's own math agreed.
- **AI that can run out safely.** Each member has their own AI allowance. When it is used up, only the AI pauses. Plans, the Keep and payments keep working.

## How it works

```
You ──> Pocket web app ──> Pocket server
                            │
                            ├─> Otari gateway (service key, you as an end user with a budget)
                            │     ├─ guardrail mandate ──> Pocket guard service (/api/guard)
                            │     ├─ pocket-intent  ──> gpt-oss-20b, backups Ministral 3 8B, gpt-oss-120b
                            │     ├─ pocket-explain ──> DeepSeek V4.1 Flash, lighter gpt-oss-120b
                            │     ├─ web fetch      ──> ECB daily reference rates
                            │     ├─ code execution ──> savings projection, rechecked by Pocket
                            │     └─ MCP            ──> Pocket wallet server (/api/mcp, read only)
                            │
                            └─> Policy engine (decides) ──> settlement on Monad testnet, after your approval
```

Models read and explain. They never decide. A model's reading of a payment is checked against what you typed, and the policy engine makes the only decision.

## Stack

TanStack Start (React 19, Vite, Nitro) on Vercel; Privy for sign in and embedded wallets; Neon Postgres with Drizzle; Otari for all AI; Monad testnet for settlement (AUSD); Vitest for tests.

## Run it

```bash
npm ci
cp .env.example .env        # names only; fill in your own values
npm test                    # all Otari calls are mocked; no key needed
npm run dev                 # http://localhost:3000
```

To use your own Otari account, follow "Otari dashboard setup" in [OTARI.md](OTARI.md). Apply the database migrations in `drizzle/migrations` in order (the Otari branch adds `0003_otari_ai_requests.sql`).

Every AI state, with sample data, is at `/states/otari` in development.

## Proof

- **Tests:** `npm test`. Covers Otari header parsing, mapping of every Otari refusal to what the member sees, the intent role against invented amounts and hostile text, the streamed explainer with receipts, the projection run in Python and TypeScript with an exact match, the guard service contract and a corpus of 30 attacks and 40 ordinary requests, the wallet MCP server and its tokens, and the existing policy engine.
- **Types:** `npx tsc --noEmit`.
- **Build:** `npm run build`.

## Safety notes

- Pocket runs on Monad testnet. Nothing here is regulated financial advice.
- The wallet MCP server has no tool that can move money.
- Keys live only in environment variables. `.env` is never committed; `.env.example` lists names only.
