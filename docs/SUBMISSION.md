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
| Tracks | one or more of the track ids | `realworld`, `privacy`, `security`, `open` |
| NEAR address (payout) | mainnet account, lowercase | henrysammarfo.near (checked on mainnet with a read only `view_account` call on 14 Nov 2026: the account exists) |
| Project URL | public repo, not used by another entry | https://github.com/henrysammarfo/pocket |
| Demo URL | link to a public X post with the video or screenshots, up to 300 characters, like `https://x.com/<handle>/status/<id>` | **Henry posts the video on X and pastes the post link** |
| Idea | 20 to 2,000 characters | the "What we built" text below (about 1,900 characters) |
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

## What we built (paste this into the Idea field, under 2,000 characters)
Pocket is a money app you simply talk to.

Try it in two minutes. Open https://pocket-zeta-lime.vercel.app and tap Get started. Pocket makes you a free NEAR testnet account and adds 1,000 test dollars. No seed phrase, no fees to think about.

Now type or say something like "send Mum 50 dollars and put 25 in Tesla". It is fine to be messy, with ums, repeats or Pidgin. Pocket tells you what it understood and shows one simple card with the plan. Nothing happens until you press and hold to approve. Then you get a receipt you can check on the public NEAR record.

Why it is safe. The AI never holds your keys. It can only suggest a plan. Pocket checks every plan against your own rules, like a daily limit and an amount to always keep, and blocks anything that breaks them. Your own device signs every payment, and raising your limit needs your passkey. We tried to trick the AI into sending everything, and the rules stopped it.

Why it is private. Your chats, receipt photos and voice notes are read by AI running inside sealed, checkable hardware on NEAR AI Cloud, which keeps them hidden from the company running the servers. Pocket keeps no chat text on its server; your history stays in your browser. You can check the seal yourself in Settings. If the private AI is busy, a backup that is not private steps in; the README is open about this and other limits.

What is real. Everything runs on NEAR testnet with test money only. Payments cost you nothing because Pocket covers the network fees. A paper stock trade either happens in full or not at all, settled by NEAR Intents.

For judges. Code: https://github.com/henrysammarfo/pocket
1. Run npm ci, then export BASE=https://pocket-zeta-lime.vercel.app
2. Run npm run smoke and see ALL PASS.
3. Run npm run attack and see every attack refused.
4. Run npm run verify:tee and see the hardware check pass.
Saved results: docs/TEST_REPORT.md

## Demo video
`video/pocket-demo.mp4`, about 1 min 38 s: title card, the problem, sign up, wallet, a chat question, a messy voice note heard back cleanly, the plan card (zoomed), hold to approve, the receipt from chain, Settings with credits and memory, the desktop Invest view, the NEAR stack card, the tests card, end card. English voiceover, captions, no music. Rebuild with `npm run video`; scenes and lines are in [scripts/video/script.json](../scripts/video/script.json).

## X post draft (Henry posts it)
Short post, 87 characters, with the demo video attached:
> Pocket, the money app you talk to. Built at NEAR HACKATHON @NEARProtocol #NEARHackathon

Same post with the live link (111 characters as X counts them, the link counts as 23):
> Pocket, the money app you talk to. Built at NEAR HACKATHON @NEARProtocol #NEARHackathon https://pocket-zeta-lime.vercel.app

Longer version if wanted (standard accounts allow 280 characters):
> Pocket, the money app you talk to, built at NEAR HACKATHON on @NEARProtocol #NEARHackathon. Say "send Mum 50 and put 25 in Tesla", get one plan, hold to approve. Private AI on NEAR AI Cloud, gasless sends, atomic trades via NEAR Intents. Testnet. https://pocket-zeta-lime.vercel.app

## Why it stands out
- A normal person can use it: one plan card, one hold, plain words, no seed phrase, no gas.
- Private AI: chats, photos, voice and web search run in attested TEEs on NEAR AI Cloud, the server keeps no chat text, and a Verified screen in Settings (and `npm run verify:tee`, `GET /api/attest`) checks fresh attestation live.
- AI with money, done safely: the model only proposes, code checks, the user signs, and server policy limits what the relayer pays for.
- Real NEAR, not a mock: NEP-413, NEP-366, NEP-141 and the unmodified NEAR Intents verifier v0.4.2 with its published hash.
- Reproducible by an AI judge in one command, with machine readable steps in AGENTS.md, a test report in docs/TEST_REPORT.md, and `npm run attack` showing a prompt injected plan stopped.
