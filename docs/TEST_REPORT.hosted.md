### Full journey in a real browser on the live site (`npm run e2e:hosted`), 14 Nov 2026 08:29 (Africa/Accra, UTC+0)
Fresh browser profile and a fresh testnet account for each size: sign up, faucet, chat small talk, a messy voice note, the plan, a send with hold to approve, a TSLAon buy and its receipt, Settings.

**Phone 390x844: 13 PASS, 0 FAIL**

```
PASS signed up hpg5892a.pocketnear.testnet
PASS faucet: 1,000 pUSD arrived at sign up
PASS second faucet claim answered: Added 1,000.00 pUSD
PASS small talk: Hey Ama! I’m Pocket, your friendly money‑app buddy. I can help you send test dollars to contacts, buy or sell 
PASS voice note heard as: E H M. So I want to, like, send send at admin or $5, and put 10 in tesla abeg.
PASS Pocket said back: You want to send $5 to admin and buy $10 worth of Tesla stock, correct?
PASS voice confirm led to a plan card
PASS send settled: Send to @admin | $2.00 | Receipt | Network fee | 0.00 | Pocket pays it | Arrives | about 2 s | Your balance after | $1,998.00
PASS TSLAon receipt: −10.00 pUSD | Bought TSLAon, 0.0258 TSLAon at $387.90 | Completed | Signed on your device | 14 Nov, 08:28:54 | Order filled on NE
PASS NearBlocks link https://testnet.nearblocks.io/txns/2hMy7mpfiKPWPcmV3TiHHGwPXHNSSNvYRK8kBF7dp7TX
PASS credits: 988 of 1,000 left
PASS no horizontal overflow
PASS no page errors 
```

**Desktop 1440x900: 13 PASS, 0 FAIL**

```
PASS signed up hdg59hk9.pocketnear.testnet
PASS faucet: 1,000 pUSD arrived at sign up
PASS second faucet claim answered: Added 1,000.00 pUSD
PASS small talk: Hey Ama! I’m Pocket, your friendly money‑app helper. I can keep track of your test dollars, send money to cont
PASS voice note heard as: E H M. So I want to, like, send send at admin or $5, and put 10 in tesla abeg.
PASS Pocket said back: You want to send $5 to admin and buy $10 of Tesla stock, right?
PASS voice confirm led to a plan card
PASS send settled: Send to @admin | $2.00 | Receipt | Network fee | 0.00 | Pocket pays it | Arrives | about 2 s | Your balance after | $1,998.00
PASS TSLAon receipt: −10.00 pUSD | Bought TSLAon, 0.0258 TSLAon at $387.99 | Completed | Signed on your device | 14 Nov, 08:29:52 | Order filled on NE
PASS NearBlocks link https://testnet.nearblocks.io/txns/DK7HCEtNdsW8mhizFzmTm5wwaeC77t1xXdSfPA5e6kQb
PASS credits: 988 of 1,000 left
PASS no horizontal overflow
PASS no page errors 
```


### Live site after private AI went live (PR #11), 14 Nov 2026 13:40 (Africa/Accra, UTC+0)
AI: NEAR AI Cloud private TEE models (`Qwen/Qwen3.6-35B-A3B-FP8` chat, `Qwen/Qwen3-VL-30B-A3B-Instruct` photos, `openai/whisper-large-v3` voice), Groq fallback.
- `npm run smoke`, `npm run attack`: ALL PASS
- `npm run e2e:hosted` (full journey, phone and desktop): ALL PASS
- `tests/e2e/chat-voice.mjs` (small talk, messy voice note, confirm, plan, memory, credits): ALL PASS
- `tests/e2e/chat-abilities.mjs` (date, news with sources, product finds with real links, live price, receipt photo read, bill split, chats drawer new, rename, delete): ALL PASS
- `tests/e2e/passkey.mjs` (add, use and remove a passkey with a virtual authenticator): ALL PASS
- `npm run verify:tee`: ALL PASS for all three models
