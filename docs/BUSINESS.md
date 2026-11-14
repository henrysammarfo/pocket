# How Pocket makes money

Plain words, one page. This is a plan for later. Today Pocket runs on NEAR testnet with test money, and nothing is charged.

## What the big apps do

| App | Main ways it earns | What people see |
| --- | --- | --- |
| Chime | A share of the card fee shops pay when you swipe (interchange), about 69% of its 2025 revenue | Free account, no monthly fee |
| Cash App | Card interchange, a spread on bitcoin, fees for instant cash out, business fees | Free to send to friends, small fee to cash out fast |
| Wise | A small upfront fee on each cross border transfer, about 0.5% on average in FY2026, plus card fees and interest on balances | Fee shown before you send |
| Revolut | Card fees, paid plans, currency exchange, crypto spreads (0 to 0.09%), stock fees (about 0.25%), interest, loans | Free plan plus paid plans with more included |
| Robinhood | Paid by the firms that fill your orders, interest on cash, the Gold plan | No commission shown, paid plan for extras |
| AI apps (ChatGPT, Claude, Perplexity, Cursor) | A free tier with a cap, then a monthly plan or credit packs | You see how much you have left |

What works for all of them: the everyday thing is free, the fee is small and shown before you tap, and power users pay a plan.

## Pocket's plan

1. **Free to start.** Sign up, hold dollars, and send to other Pocket people for free. Pocket pays the network fee (gas) for you.
2. **A small fee on buys, sells and swaps.** 0.5% on each trade, shown on the plan card before you approve. No hidden spread on top.
3. **A small fee on cross chain sends** (roadmap). 0.3%, shown upfront, in line with Wise.
4. **AI credits.** Every person gets 1,000 free AI credits a month. That is about 150 to 300 chat replies or voice notes. Need more? A credit pack (5,000 credits for $1) or Pocket Plus ($3 a month, 10,000 credits plus lower trade fees).
5. **Later:** interest on idle dollars shared with the user, and a Pocket card that earns interchange.

## How AI credits work

1 credit is about $0.0001 of real AI cost, so 1,000 free credits cost Pocket about 10 cents per person per month.

| Action | Credits | Why |
| --- | --- | --- |
| Chat reply | at least 2, then the real token cost | Measured from the provider's token count after each reply |
| Voice note | 3 | Speech to text bills at least 10 seconds of audio per note |
| Plan card, approve, send, trade | 0 | Money actions never cost credits |
| Built in helper (when AI is off or credits run out) | 0 | Runs on Pocket's own server code |

Metering is on the server, per account and per month, in Neon Postgres (key `credits:<account>:<month>`). If the AI fails, the credits are refunded. The meter is in Settings, under AI credits. When credits run out, Chat keeps working with the free built in helper, so nobody is ever locked out of their money.

## What it costs to run

| Cost | Today (free tiers) | At scale |
| --- | --- | --- |
| Chat AI | Groq free tier, openai/gpt-oss-120b | $0.15 in and $0.60 out per million tokens, about $0.0005 per reply |
| Voice | Groq free tier, whisper-large-v3 | $0.111 per hour of audio, about $0.0003 per note |
| Private AI option | NEAR AI Cloud, TEE hosted models | Similar per token prices, chosen with one env var |
| Gas | Free on testnet | Under $0.001 per NEAR transfer; covered by trade fees |
| Database | Neon free tier | Neon paid plans as users grow |
| Hosting | Vercel hobby | Vercel pro, or self host with Docker |

A person who trades $200 a month brings in $1 in fees. Their free AI and gas cost about 15 cents. That is the core of the model.

## Limits that stop abuse

- **Per account:** 1,000 free credits a month, 90 chat messages an hour, voice notes up to 20 MB.
- **Per IP:** 120 chats and 60 voice notes an hour, and sign up limits.
- **Whole server:** caps that keep Pocket inside the provider's free tier (Groq free: 30 chat calls a minute and 1,000 a day; 20 voice calls a minute). Over the cap, Chat falls back to the built in helper instead of failing.
- **Money:** the AI can only propose. Every plan is checked in code, every move needs a hold to approve, a daily send limit with passkey approval to raise it, and the relayer only pays gas for allowed Pocket contract calls.
- **Signed sessions:** AI and memory need a NEP-413 signed session from the user's own NEAR key, so nobody can spend someone else's credits.
