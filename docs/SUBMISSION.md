# Submission kit (draft, not submitted)

Nothing here has been submitted or posted. Henry submits and posts himself.

## Form fields
- **Project name:** Pocket
- **Tracks:** `realworld` (Real-World Money: stablecoins, meta transactions, NEAR Intents) and `security` (AI with money but without the keys)
- **Repository:** https://github.com/henrysammarfo/pocket (main; the hackathon work was merged from branch `near-hackathon` in PR #2)
- **Demo post:** Henry's X post link
- **NEAR payout account, team lead, email, team size, consent:** Henry fills these in himself

## What we built (under 2,000 characters)
Pocket is a money app you talk to. Say or type "send Mum 50 dollars and put 25 in Tesla", even messy, with ums, repeats or Pidgin, and Pocket says back what it understood, then shows one plan card. The plan is checked in code against your own rules (daily limit, always keep, trade cap). Nothing moves until you hold to approve on your own device, and raising your limit needs your passkey.

The AI never holds keys. It can only propose. Your browser holds an ed25519 key for a real NEAR testnet account made at sign up. Sends are gasless: pUSD moves as a NEP-413 signed intent in the NEAR Intents verifier, and USDC and NEAR move as NEP-366 meta transactions paid by a relayer that only accepts allowed calls. Paper stocks (TSLAon, NVDAon and more, live priced) settle atomically as two signed token_diff intents, yours and the market maker's, in one execute_intents call. Every move gets a public receipt rebuilt from the chain.

Chat runs on any OpenAI compatible model: Groq's free tier by default, or NEAR AI Cloud's private models with one setting. Voice uses Whisper with a prompt tuned for Ghanaian English and Pidgin. Memory and AI credits are per account in Neon, behind a signed session, and the app keeps working without any AI key.

One command to reproduce: npm run setup creates your own testnet root and contracts, and npm run test:all runs lint, unit, a fresh build, the full testnet flow and real browser tests on phone and desktop from a clean state.

## Two minute demo script
| Time | On screen | Say |
| --- | --- | --- |
| 0:00 | Welcome page on a phone | "This is Pocket. You talk to it, and it moves money for you, but only when you say so." |
| 0:08 | Type a username, tap Create my Pocket | "That just made a real NEAR testnet account. I paid no gas and saw no seed phrase." |
| 0:18 | Wallet, Get test dollars | "Test dollars from the faucet." |
| 0:25 | Chat, hold the mic, say "ehm send send Ama like ten dollars and put twenty in Tesla" | "I'll talk the way I really talk." |
| 0:38 | Pocket says back what it heard, tap Yes, plan card appears | "It cleaned that up, checked it with me, and made one plan. It's checked against my rules in code, not by the AI." |
| 0:52 | Review, press and hold to approve, the ring fills | "Nothing moves until I hold. Let go early and it resets." |
| 1:05 | Success, open the receipt, then NearBlocks | "Both steps settled on testnet. The receipt is rebuilt from the chain, with the price and spread." |
| 1:20 | Ask "what did I spend today?" then "I get paid on the 25th, remember that" | "It talks like a person, and it remembers what I tell it." |
| 1:32 | Settings: daily limit with passkey, AI credits meter, what Pocket remembers | "My limits, my credits and my memories, all in one place." |
| 1:45 | Terminal: npm run test:all, all PASS | "Judges and their agents can rerun all of this with one command. Pocket. Talk to your money." |

## X post draft (Henry posts it)
> Built Pocket at #NEARHackathon @NEARProtocol: a money app you just talk to. Say "send Mum 50 and put 25 in Tesla" (ums and Pidgin welcome), get one plan, hold to approve. Gasless sends, atomic trades through NEAR Intents, the AI never touches your keys. Testnet. Repo and demo: <links>. What would you ask your money?

## Why it stands out
- A normal person can use it: one plan card, one hold, plain words, no seed phrase, no gas.
- AI with money, done safely: the model only proposes, code checks, the user signs, and server policy limits what the relayer pays for.
- Real NEAR, not a mock: NEP-413, NEP-366, NEP-141 and the unmodified NEAR Intents verifier v0.4.2 with its published hash.
- Reproducible by an AI judge in one command, with machine readable steps in AGENTS.md and a test report in docs/TESTING.md.
