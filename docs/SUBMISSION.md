# Submission kit (draft, not submitted)

Nothing here has been submitted or posted. Henry submits and posts himself.

## Form fields (nearhackathon.com submit form)
Every field the form takes, with what goes in it. There are no image, logo or video upload fields; the video goes in the X post.

| Field | Rule from the form | Value |
| --- | --- | --- |
| Project name | 2 to 80 characters | Pocket |
| Lead name | 2 to 80 characters | **Henry fills in** (full name) |
| Email | up to 160 characters, at most 2 submissions per email | henrysammarfo@gmail.com |
| Team size | one of `1`, `2 - 4`, `4 - 6`, `6 - 8`, `8+` | **Henry picks** |
| Tracks | one or more of the track ids | `realworld`, `security` |
| NEAR address (payout) | mainnet account, lowercase | henrysammarfo.near (checked on mainnet with a read only `view_account` call on 14 Nov 2026: the account exists) |
| Project URL | public repo, not used by another entry | https://github.com/henrysammarfo/pocket |
| Demo URL | link to a public X post with the video or screenshots, up to 300 characters, like `https://x.com/<handle>/status/<id>` | **Henry posts the video on X and pastes the post link** |
| Idea | 20 to 2,000 characters | the "What we built" text below (about 1,500 characters) |
| Consent | must be ticked | **Henry ticks** |

Live app for judges: https://pocket-zeta-lime.vercel.app (NEAR testnet, stays up through 25 Nov). Video file to attach to the X post: `video/pocket-demo.mp4` (1920x1080 H.264, about 1 min 38 s, under the 2 min 20 s X limit), poster `docs/shots/poster.png` (1280x720).

## Self score against the judging criteria (honest, out of 10)
| Criterion | realworld | security | Why, and the gap |
| --- | --- | --- | --- |
| Technical implementation | 8 | 7 | Real NEP-413, NEP-366, NEP-141 and the verifier, all live on testnet. Gap: user key is full access, not a function call key |
| Design | 8 | 8 | One plan card and one hold, phone first, tested 320 to 1440 px |
| Impact | 7 | 6 | Clear daily use (send home, hold dollars, buy a stock). Testnet only, no cross chain yet |
| Originality | 7 | 7 | Messy voice to a checked plan, atomic trades as two signed intents, attack suite for the agent |
| Sustainability | 6 | 6 | Metered credits and a business model doc; no paying users yet |
| **Average** | **7.2** | **6.8** | |

## What we built (under 2,000 characters)
Pocket is a money app you talk to. Say or type "send Mum 50 dollars and put 25 in Tesla", even messy, with ums, repeats or Pidgin, and Pocket says back what it understood, then shows one plan card. The plan is checked in code against your own rules (daily limit, always keep, trade cap). Nothing moves until you hold to approve on your own device, and raising your limit needs your passkey.

The AI never holds keys. It can only propose. Your browser holds an ed25519 key for a real NEAR testnet account made at sign up. Sends are gasless: pUSD moves as a NEP-413 signed intent in the NEAR Intents verifier, and USDC and NEAR move as NEP-366 meta transactions paid by a relayer that only accepts allowed calls. Paper stocks (TSLAon, NVDAon and more, live priced) settle atomically as two signed token_diff intents, yours and the market maker's, in one execute_intents call. Every move gets a public receipt rebuilt from the chain.

Chat runs on any OpenAI compatible model: Groq's free tier by default, or NEAR AI Cloud's private models with one setting. Voice uses Whisper with a prompt tuned for Ghanaian English and Pidgin. Memory and AI credits are per account in Neon, behind a signed session, and the app keeps working without any AI key.

Live on testnet at https://pocket-zeta-lime.vercel.app. One command to reproduce: npm run setup creates your own testnet root and contracts, and npm run test:all runs lint, unit, a fresh build, the full testnet flow and real browser tests on phone and desktop from a clean state.

## Demo video
`video/pocket-demo.mp4`, about 1 min 38 s: title card, the problem, sign up, wallet, a chat question, a messy voice note heard back cleanly, the plan card (zoomed), hold to approve, the receipt from chain, Settings with credits and memory, the desktop Invest view, the NEAR stack card, the tests card, end card. English voiceover, captions, no music. Rebuild with `npm run video`; scenes and lines are in [scripts/video/script.json](../scripts/video/script.json).

## X post draft (Henry posts it)
> Pocket: a money app you just talk to, on @NEARProtocol, #NEARHackathon. Say "send Mum 50 and put 25 in Tesla", get one plan, hold to approve. Gasless sends, atomic trades via NEAR Intents, and the AI never holds your keys. Testnet. https://pocket-zeta-lime.vercel.app https://github.com/henrysammarfo/pocket

## Why it stands out
- A normal person can use it: one plan card, one hold, plain words, no seed phrase, no gas.
- AI with money, done safely: the model only proposes, code checks, the user signs, and server policy limits what the relayer pays for.
- Real NEAR, not a mock: NEP-413, NEP-366, NEP-141 and the unmodified NEAR Intents verifier v0.4.2 with its published hash.
- Reproducible by an AI judge in one command, with machine readable steps in AGENTS.md a test report in docs/TEST_REPORT.md, and `npm run attack` showing a prompt injected plan stopped.
