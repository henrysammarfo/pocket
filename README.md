<p align="center"><img src="public/brand/coil.svg" width="64" alt="Pocket" /></p>

# Pocket: a money app you talk to

*Live on NEAR testnet. Open source, MIT.*

**The problem.** Sending money home, holding dollars or buying a stock usually means several apps, fees you only see later, and screens that assume you already know finance. AI could help, but nobody should hand an AI their keys.

**What Pocket does.** You talk to it like a friend: *"Send Mum 50 dollars and put 25 in Tesla"*. Pocket tells you what it understood and shows one simple plan card. It checks the plan against your own rules, and nothing moves until you **press and hold to approve** on your own device. You never pay network fees, and every payment gets a receipt you can check on the public NEAR record.

**Try it in two minutes: https://pocket-zeta-lime.vercel.app**
1. Tap **Get started**. Pocket makes you a free testnet account and adds 1,000 test dollars.
2. Type or say *"send @admin 2 dollars"*. You see one plan card.
3. Press and hold to approve. You see a receipt with a link to the public record.
4. Ask for today's news or the Tesla price, or add a receipt photo and ask Pocket to split the bill.

**Safe by design.** The AI never holds your keys and can only suggest. Your rules are checked in code, and your device signs every payment. On the `onchain-limits` branch the caps live in a smart contract on your account and the browser holds only a limited key, see [On chain spending limits](#on-chain-spending-limits-this-branch).

**Private by design.** Chats, photos and voice notes are read by AI running in sealed, checkable hardware on NEAR AI Cloud. Pocket's server keeps no chat text; your history stays in your browser. What this does and does not protect is written down plainly in [What the TEE does and does not protect](#what-the-tee-does-and-does-not-protect).

**Testnet only. No real money.** Test dollars (pUSD), Circle testnet USDC and paper stocks (TSLAon, NVDAon, AAPLon, SPYon, QQQon) with live prices. Test results: [docs/TEST_REPORT.md](docs/TEST_REPORT.md). Hackathon diff: [near-baseline...main](https://github.com/henrysammarfo/pocket/compare/near-baseline...main). Technical detail for reviewers and AI judges starts below.

## After the deadline (14 Nov 2026 23:59 UTC)

The version submitted at the deadline is commit [`dbe5d86`](https://github.com/henrysammarfo/pocket/commit/dbe5d86e42f35e15688252555fb76f34b590f387) (message: *Merge pull request #20 from henrysammarfo/readme-settlemark-name*, 14 Nov 2026 23:08 UTC). That submitted tree still works and can be tested on its own: run `git checkout dbe5d86` and follow the README in that commit, or browse it at [github.com/henrysammarfo/pocket/tree/dbe5d86](https://github.com/henrysammarfo/pocket/tree/dbe5d86e42f35e15688252555fb76f34b590f387). The Try it link at the top is the production site, which served this submitted commit at the deadline; once this branch is merged into main that site may be updated, so the reliable way to test the submitted version is to check out that commit. Nothing listed below was part of the submitted version.

Every commit below was made after the deadline, on 15 Nov 2026 UTC, first on the `onchain-limits` and `private-pool` branches, then on `main`. This section is here so a judge can tell later work apart from the submitted version.

**Commits after `dbe5d86` (oldest first, the same set as `git log dbe5d86..main --oneline --reverse`):**

- [`90d4da4`](https://github.com/henrysammarfo/pocket/commit/90d4da41aa9f711baff4c1e65ddb725976f9b532) Add Pocket wallet and market contracts that enforce spending limits on chain
- [`3a29f8e`](https://github.com/henrysammarfo/pocket/commit/3a29f8ec9509079fd63289e38299a4877cc5c8fa) Deploy the wallet global contract and market to a fresh testnet root and verify their code hashes
- [`3f526fe`](https://github.com/henrysammarfo/pocket/commit/3f526fe253c53f95f529782d7c82aa53fa518d8b) Sign up with a limited phone key and a recovery key, and route sends and trades through the wallet contract
- [`e96ba10`](https://github.com/henrysammarfo/pocket/commit/e96ba1099bc8e6c494d03e884d84506984509c2d) Chat answers live stock prices and knows the current date and time
- [`7112a14`](https://github.com/henrysammarfo/pocket/commit/7112a1422bc33e4dd231df2b2365f68a85f0c671) Add testnet attack suite and unit tests for on chain limits
- [`1298356`](https://github.com/henrysammarfo/pocket/commit/129835617a8b9242faa2309ad4409cba158c2f6c) Document what is enforced on chain and what is not
- [`0aa1095`](https://github.com/henrysammarfo/pocket/commit/0aa10957a204e12f3f6ea56c9a1cfb3c46af209a) Check every receiver before a send: allow, warn or block with reasons, enforced again by the relayer
- [`70fc6fd`](https://github.com/henrysammarfo/pocket/commit/70fc6fddcf1f590003f43ec755eed30e8aa02694) Export receipts as CSV with formula safe cells
- [`21a0a48`](https://github.com/henrysammarfo/pocket/commit/21a0a48d5fd7fdd00de940bd8318b97179a31bfd) Request money links that show pending, paid or refunded from chain accepted sends
- [`3cfb4d2`](https://github.com/henrysammarfo/pocket/commit/3cfb4d2767256a2e47c1f196a83fa22f0fd6e6cf) Deeper tests: model based wallet checks, testnet section for receivers, requests and CSV; docs
- [`862becb`](https://github.com/henrysammarfo/pocket/commit/862becb7769cb8d126598e9b46c0cb59798055af) Testnet report with explorer links for every check that reached the chain
- [`d96c441`](https://github.com/henrysammarfo/pocket/commit/d96c441e2f82f0525377d9e27baae70f0bace65d) Browser run for the on chain branch; no Checked chip on a blocked receiver
- [`9ef7442`](https://github.com/henrysammarfo/pocket/commit/9ef744215078378ebc30295e8f25576f34a23fec) Wallet v2: recovery key signs owner messages (no full access key), Pocket signed prices for dollar caps on NEAR and stocks, shared block list with evidence, new account warning, private AI only by default
- [`07f96c6`](https://github.com/henrysammarfo/pocket/commit/07f96c65b31fc3fe7fbda9ba9ec05cfdb7fa8bdb) Receiver check on chat plan cards and the review screen: a plan to a blocked account cannot be approved
- [`8ea0e9a`](https://github.com/henrysammarfo/pocket/commit/8ea0e9a56a36f9fc30135e289966dfe8ecdfb2e4) Persona run fixes: per send cap in the plan check, shared block list at the address step, privacy facts in chat, bigger privacy switch, persona harness
- [`049f43a`](https://github.com/henrysammarfo/pocket/commit/049f43a0b717d1ef77650e343e07cc15fa5f74a5) Attack run section 11: a hijacked chat tries to pay a known drainer; receiver check, relayer and wallet contract all refuse (7 of 7 on testnet)
- [`8d33103`](https://github.com/henrysammarfo/pocket/commit/8d331030e09226de37b4d65c6263153f3bfdeccc) Private AI check runs in the browser against NEAR AI Cloud with its own nonce, so it does not trust Pocket's server
- [`bcc5624`](https://github.com/henrysammarfo/pocket/commit/bcc5624e21150c952d64903206e6e4f5b4082855) Wallet v2 live on testnet: 17 checks on a demo account with no full access key; fix viewAccessKey treating a missing key as present
- [`6d062a7`](https://github.com/henrysammarfo/pocket/commit/6d062a721c1babc64f7c93b1164326c64d6d1869) README: wallet v2, signed prices, shared block list, private AI only, what stays public
- [`05aed97`](https://github.com/henrysammarfo/pocket/commit/05aed974310c996b67dcf03e2755f7bbce70ecf2) POLICY: W10 to W13 for wallet v2 and the shared block list
- [`019ccf1`](https://github.com/henrysammarfo/pocket/commit/019ccf13f7fa75632819f29de4b9d4c2194c3a0f) Request links can carry a due date; pay page and your list show Due by or Overdue
- [`8398a7d`](https://github.com/henrysammarfo/pocket/commit/8398a7de8bb2693b09e0f3b016ed7dff40829ceb) Chat answers a request money ask with a prefilled request form; persona harness checks it end to end
- [`425b743`](https://github.com/henrysammarfo/pocket/commit/425b7438e665a5e270ff5860d0d795e0757cfb0f) Persona harness: taps Yes on confirm questions and Go back on the blocked sheet, adds an over cap send for Kofi
- [`3d35ee4`](https://github.com/henrysammarfo/pocket/commit/3d35ee446ba9383fb65da2b60316b165abc49372) README: 336 unit tests on this branch
- [`c048144`](https://github.com/henrysammarfo/pocket/commit/c048144faff24252d6beedf3583ef21314125517) Chat explains the recovery key correctly (one key shown once, restore with I have a backup key); persona check fails a seed phrase answer
- [`b5ed982`](https://github.com/henrysammarfo/pocket/commit/b5ed9828a01ca941ea5aee9e356dfa5df6eff472) Receiver check: no brand new account warning for someone you already paid or saved
- [`9faef88`](https://github.com/henrysammarfo/pocket/commit/9faef880061a2c948817e6ae8dd7530f9ac33743) Attack run: EXTRA_NEAR sets the gas money per test account
- [`3a35d05`](https://github.com/henrysammarfo/pocket/commit/3a35d0579981cfeaaf19429a26b0e013a3ce9ed5) Private pool: circuit and contract (adapted from hideyour.cash, credited)
- [`906132f`](https://github.com/henrysammarfo/pocket/commit/906132ffc03ea9caefa711fe0c0c93fa29fd6c5e) Private pool: shared note and tree code, proving files, 19 contract tests with a real proof
- [`ff0e0d0`](https://github.com/henrysammarfo/pocket/commit/ff0e0d00ce9ca1a99d434b92d748942816d868c2) Wallet: send_private puts NEAR into the private pool only after the NEAR and dollar caps pass; 8 new tests
- [`6a009b6`](https://github.com/henrysammarfo/pocket/commit/6a009b64b33e7f0ef7244d583352e2de6391f01f) Pool deployed on testnet (pool.pocket-7e2413.testnet); relayer policy for send_private; testnet proof script
- [`1c939f6`](https://github.com/henrysammarfo/pocket/commit/1c939f68542d7f731f09b3e9ce25496757dca474) Testnet proof: two deposits, one private withdrawal to a new account, five attacks refused on chain
- [`ac8529c`](https://github.com/henrysammarfo/pocket/commit/ac8529c7128d55d7369982f88e00b8d06f934f63) Testnet proof: private sends through a wallet obey its on chain per send and 24 hour NEAR caps
- [`ab509cf`](https://github.com/henrysammarfo/pocket/commit/ab509cf013b00db1531aa07c2b3110faafea9daa) App: Private balance page, private send with a proof made in the browser, relayer route, chat knows what is hidden
- [`077f23b`](https://github.com/henrysammarfo/pocket/commit/077f23b4fd5de98f514b461a3763a5e45b47684d) Unit tests for the pool tree, notes and relayer policy
- [`4bf346e`](https://github.com/henrysammarfo/pocket/commit/4bf346e3d55f8138b7157218ee19901afe8447f0) Private page: turn Add off with a plain reason when the wallet is older than v3
- [`24457c6`](https://github.com/henrysammarfo/pocket/commit/24457c6e1f744519b2a223a132f4185256cfb2e7) Persona harness: private balance page, chat answer, pool route attacks, README pool claims on chain
- [`0838a87`](https://github.com/henrysammarfo/pocket/commit/0838a879a5869a547fc792b7959291d1077bb572) Docs: SOURCES.md and the pool test report with NearBlocks links
- [`60915b5`](https://github.com/henrysammarfo/pocket/commit/60915b5d88c0220ae94d25d3e4afefdd2719d7c2) README and POLICY: private pool section, what is hidden and not, trust assumptions, NearBlocks links
- [`94560a9`](https://github.com/henrysammarfo/pocket/commit/94560a9d97e970053eec07914b3e83c4d611c003) Private page: card no longer covers the Add button; field styling; browser test for a private send
- [`bb9383c`](https://github.com/henrysammarfo/pocket/commit/bb9383cc0cd78e8eed66386658c6bf5f5cb2e2f4) Chat: assume the default 100 dollar per send cap until the wallet rules load, so a 150 dollar plan is never shown as within the rules
- [`5f5ec52`](https://github.com/henrysammarfo/pocket/commit/5f5ec52446af4f376f586c3b703e8bc5cbba5848) Private page message has a test id; browser test waits for it
- [`043ea02`](https://github.com/henrysammarfo/pocket/commit/043ea02fcc1cce19cdf90da19419ae0db5b0dc8d) Relayer: send_private has no receiver_id (the pool is fixed in the wallet), so skip the receiver check for it
- [`858a18a`](https://github.com/henrysammarfo/pocket/commit/858a18a8f53704042da7009e34938c0778f7a1ec) Send privately toggle on the normal Send screen, with friendly progress text
- [`5e01ddc`](https://github.com/henrysammarfo/pocket/commit/5e01ddcf43d660b266a9db11a5ef276f8b7f9931) Plain words across the app: Hidden balance page, no network jargon in screens
- [`78b3fe9`](https://github.com/henrysammarfo/pocket/commit/78b3fe963b14ca3fd1eaea7b5bc6943306938f39) Plain words on the landing page
- [`f17d950`](https://github.com/henrysammarfo/pocket/commit/f17d950e2bf28beccbd69755051a4bad5b5eb568) Friendly error messages for private send and signup
- [`dc300c8`](https://github.com/henrysammarfo/pocket/commit/dc300c85a903bad6c490379b8b84dfdd7da21952) Plain words in chat instructions, receiver checks and error messages
- [`a9283a7`](https://github.com/henrysammarfo/pocket/commit/a9283a7de19da9cbeeb3876b3dd94fa843db5c24) Persona jargon check now fails the run and scans every screen and the chat answer; browser test uses the Send privately toggle
- [`b79c1a2`](https://github.com/henrysammarfo/pocket/commit/b79c1a23402a570e4616701fabad5fb8fff711e8) Browser test seeds storage once per tab
- [`824ca18`](https://github.com/henrysammarfo/pocket/commit/824ca18b82b4377736e9dad0589286776112877f) Refusals show the account's plain reason, not the raw network error
- [`be8a5d2`](https://github.com/henrysammarfo/pocket/commit/be8a5d24a7a27ba9033ccb36d5bc25a69626c4b2) Browser test: Send privately over the daily limit must be refused in plain words
- [`48736b1`](https://github.com/henrysammarfo/pocket/commit/48736b1d143351bb307bb8a9c50bfd584ff7f86d) Plain receiver labels on the Send screen; browser test taps Continue
- [`efb50f3`](https://github.com/henrysammarfo/pocket/commit/efb50f38beb91dbab5fb82ac977f3ccd3b365e6c) Plain network picker labels
- [`e6bf77c`](https://github.com/henrysammarfo/pocket/commit/e6bf77c39e7beaaf80a5de618f2c6ec4ac356764) Settings network row in plain words; jargon scan skips links
- [`adc472c`](https://github.com/henrysammarfo/pocket/commit/adc472cb334ea9cac6279701d69e06b22cc1ea93) Judge check: landing must say test money with no real value
- [`3b8f175`](https://github.com/henrysammarfo/pocket/commit/3b8f17555aeee80b16f95f1d2e501c4cbb2a21fe) Fix: a 64 character NEAR address is looked up as itself, not as a Pocket username; fix a typo from the word sweep
- [`b0c8e7c`](https://github.com/henrysammarfo/pocket/commit/b0c8e7c401954627e0f325c4b416c3c423d7efe6) README: plain words in the app, browser private send tx, current test counts, onchain suite marked as not rerun
- [`feb6031`](https://github.com/henrysammarfo/pocket/commit/feb60315b7ba0e9a9f97e7e37283e12ffb370047) Relayer calls use 100 TGas so faucet and private send do not reserve 0.3 NEAR
- [`e63b26b`](https://github.com/henrysammarfo/pocket/commit/e63b26bb5198926aa982894af97c0926dbda9803) README: After the deadline section, with a link to the submitted commit and every later commit
- [`bcaf44d`](https://github.com/henrysammarfo/pocket/commit/bcaf44d328a83b806ea86895df56ef8f3783e16f) Plain signup and server error messages. Sign up shows @username, not the raw account id.
- [`87c3a6f`](https://github.com/henrysammarfo/pocket/commit/87c3a6f662f6058bd65c8c84cad1e0a7885dd48e) Plain words in chat, review, pay, swap and recipient errors. Chat avatar is 44px.
- [`3a37459`](https://github.com/henrysammarfo/pocket/commit/3a374591bd2f99712df8e68c2ceb95a4b27c6789) Show @username on wallet, settings and coin pages. NEAR about text says sending is free. The coin chart has a plain fallback if prices fail.
- [`fef935a`](https://github.com/henrysammarfo/pocket/commit/fef935a7dafe2966e2f559ddbb50165f4eb9b23f) Larger tap targets, Verify no longer clips, and the landing badge sits higher so it does not cover the chat bubble.
- [`43b8f3a`](https://github.com/henrysammarfo/pocket/commit/43b8f3a552c74c343ad8df0ecf5a0f9fd4900fba) Invest and charts show a plain fallback if prices cannot be loaded, instead of staying on Connecting.
- [`d89d707`](https://github.com/henrysammarfo/pocket/commit/d89d7072747cb75bfcfb5dc0bc45c5ab5eca8c4a) Landing mockups use Test money, Sending is free, and @username, with the model name removed.
- [`3ab27b1`](https://github.com/henrysammarfo/pocket/commit/3ab27b1a3919797a1c2f0b0d5eaebfd51ecb556e) README: add the post-deadline UI fix commits to the After the deadline list
- [`d56f109`](https://github.com/henrysammarfo/pocket/commit/d56f1095a5bbd321a9e9cb17cae08443c0c9d467) Load the NEAR chart from CoinGecko in parallel, fall back to Coinbase Exchange candles, and only show the plain fallback after the request finishes.
- [`3933a12`](https://github.com/henrysammarfo/pocket/commit/3933a12d8ee5c8d24d0416f54af2150c6229935c) Show Prices from public market data in the app. Named sources stay in the docs.
- [`b176707`](https://github.com/henrysammarfo/pocket/commit/b17670782f5526e10e1e9719587098310292d5db) Profile shows @username and a single line account id with ellipsis and a copy button. Settings no longer repeats the username.
- [`28553be`](https://github.com/henrysammarfo/pocket/commit/28553be0dac9683c9480982f480c6afc0983b069) Make chart range chips, swap tokens, Get started, the landing pill, Contacts and See all, and settings switches at least 44px.
- This commit, which adds the later main commits to this list.

## On chain spending limits (this branch)

The `onchain-limits` work, later continued on `private-pool`, moves the spending rules from Pocket's server into a NEAR smart contract on every user account. The submitted version at the deadline is `dbe5d86`; see [After the deadline](#after-the-deadline-14-nov-2026-2359-utc) to test that version on its own. This work runs on its own fresh testnet deployment, root `pocket-7e2413.testnet`. Preview of this branch: https://pocket-git-private-pool-teamtitanlink.vercel.app. Earlier `onchain-limits` preview: https://pocket-git-onchain-limits-teamtitanlink.vercel.app

**How it works.** At signup Pocket creates your account, points it at the Pocket wallet contract (a NEAR global contract fixed by its code hash, so nobody can swap the code under you), and adds two keys in one transaction:

1. A **phone key** kept in the browser. It is a function call access key that can only call your own account, only these methods: `send_near`, `send_usdc`, `send_token`, `trade`, `lower_limits`, `cancel_pending`, `owner_action`, and on the `private-pool` branch `send_private` ([list in code](src/lib/shared/wallet.ts)). It has a gas allowance of 0.25 NEAR and it cannot attach a deposit, add keys, deploy code or call any other contract.
2. A **recovery key**, the only full access key. Pocket shows it once, you copy or download it, and it is never stored in the browser.

Pocket still pays gas for normal use through the relayer (NEP-366 meta transactions), so the phone key's allowance is only spent if you send a transaction yourself.

**What the contract enforces on chain.** Every rule below is checked in Rust by `contracts/wallet`. A call that breaks a rule panics, and a panic in NEAR rolls back all state, so nothing moves.

| Rule | Default |
| --- | --- |
| Dollar cap per send (pUSD and USDC) | $100 |
| Dollar cap per rolling 24 hours, counted in hourly slots | $200 |
| NEAR cap per send and per 24 hours | 1 NEAR and 2 NEAR |
| Cap per stock token per send and per 24 hours | 5 and 20 shares |
| Largest single trade | $1,000 |
| Which actions are allowed: NEAR, USDC, tokens, trades | all on |
| Allow only list of recipients, and a block list | empty |
| NEAR sends always leave storage cost plus 0.01 NEAR | always |
| Trades go only to the Pocket market contract and only at a quote signed by Pocket's quote key, used once, before its deadline | always |

Sends reserve the amount before the token call and the callback gives it back if the call fails, so many sends racing in the same block can never pass the daily cap. In the testnet run, ten $40 sends fired at once from ten keys against a $200 day let exactly five through and the chain refused the other five.

**Changing the rules.** Lowering a cap, adding a block, or narrowing the allow list takes effect at once and the phone key may do it. Raising anything needs the full access recovery key: it either waits out a delay (24 hours by default) and is then applied by the next send, or the phone key may cancel it during the wait. The recovery key can also set rules instantly by calling the contract directly, which is the "full key" path. Whether a change is a raise is decided by the contract, field by field.

**Trades.** The phone key calls `trade` on its own account. The contract checks the trade size and the market account, then moves the tokens through NEAR Intents `mt_transfer_call` to `market.pocket-7e2413.testnet`. The market contract checks Pocket's ed25519 signed quote (account, amounts, deadline, one time id) and either pays out or returns the full amount. A tampered, expired, replayed, or foreign quote gets a full refund.

**Server checks stay as a second layer.** The relayer still checks every meta transaction (allowed methods, no deposit, gas cap, amounts, recipients) and keeps rate limits. The chat and the plan card still check rules before you approve. If the server were compromised, the contract still holds.

**What is not enforced on chain, said plainly.**

* Anyone holding the recovery key controls the account, as with any full access key. It could remove the contract. Keep it offline.
* When Pocket relays a call, NEAR reports the relayer as the signer, so the contract cannot tell which key signed a relayed call. Relayed calls are limited by the phone key's method list, which leaves out every rule raising method. Direct calls also check the signer is a registered owner key.
* NEAR and stock caps are counted in units, not dollars, because there is no price oracle on chain. Only pUSD and USDC count as dollars.
* Trades have their own per trade cap and do not count against the daily send cap. Their price is set by Pocket's signed quote, not by an on chain market.
* The rolling day uses hourly slots, so a send drops out of the window between 23 and 24 hours later.
* Accounts made before this branch are not moved over. They keep the old server enforced flow, and the old NEAR Intents routes remain only for them.
* The older browser suites (`tests/e2e/hosted.mjs` and friends) were written for `main` and were not rerun here. The new browser run for this branch, `tests/e2e/onchain.mjs`, passed 14 of 14 against the preview.

**Check it yourself.**

```bash
npm run verify:chain     # market code and the wallet global code hash match vendor/pocket_maker.wasm and vendor/pocket_wallet.wasm
npm run test:contracts   # Rust unit tests for the wallet (51, including model based checks) and market (13) contracts
npm run test:onchain     # testnet attack suite (needs .env.local from npm run setup): 67 checks
BASE=https://pocket-git-onchain-limits-teamtitanlink.vercel.app TO=<a pocket account> npm run e2e:onchain   # real browser: recovery key screen, limited phone key, blocked receiver, send, CSV, request link (14 checks)
```


**Explorer links from the latest testnet attack run** (67 passed, 0 failed, 15 Nov 2026). Refused attacks that reached the chain link to the failed transaction:

| Step | Transaction |
| --- | --- |
| signup: account A gets the wallet contract, a limited phone key and a recovery key in one transaction | [tx](https://testnet.nearblocks.io/txns/8YAuk5sU8yvFsExwFyNBpKTVk3WYXxA53ExnqdKfvDox) |
| send $50 pUSD gasless through the relayer | [tx](https://testnet.nearblocks.io/txns/4bay1ARGcRwhnpE3LhqfcbyU89eZcUqp244rSHQsGksG) |
| a $150 send is refused on chain (per send cap $100) | [tx](https://testnet.nearblocks.io/txns/5sRzmoSzsDazweLeP9ha2RUy1xHegdoT2MUxvCSYJD2g) |
| $100 send within caps goes through | [tx](https://testnet.nearblocks.io/txns/7Ng1QTf3HpvGbk9Vog3BhJYUNrZ1yTD8dwLrt3ZQ9Qzt) |
| USDC send fails (no USDC in the account), and the callback gives the reservation back | [tx](https://testnet.nearblocks.io/txns/7thgniY5Tvm7PQfuYRcWTvQ3QMEiPx8X4vau1vrFdPA8) |
| next $50 reaches exactly $200 for the day | [tx](https://testnet.nearblocks.io/txns/GxVRBjw1tkSWfTZkmmjHJePgD37LuXgRuiBHyZy4UbHv) |
| one more micro dollar is refused on chain (24 hour cap $200) | [tx](https://testnet.nearblocks.io/txns/CdmNtVR3VEtpc9HR9VyJ1Tj9f16Mn6UR3TpKNVYWfdwa) |
| 1.5 NEAR send refused on chain | [tx](https://testnet.nearblocks.io/txns/A6LxRaR63K1XJgfypPPZznxGAACTHUvxinw1CEXVwXvh) |
| stock send with no stock is refused and not counted | [tx](https://testnet.nearblocks.io/txns/FFDZZzsyMXnbta3XQ4iqeJG2NKBn8nkMPdgbQC8mUuJN) |
| phone key cannot raise through lower_limits | [tx](https://testnet.nearblocks.io/txns/8PKgQHo3TG57y3xnh941MgUK2FqKBkkAcSMfKgjpeejC) |
| another account's full key cannot change A's rules | [tx](https://testnet.nearblocks.io/txns/4N1AEwxBNpMKXLTr5U4VzV3P4uBunck7zGFeCYC9KxVu) |
| another account cannot spend from A's wallet | [tx](https://testnet.nearblocks.io/txns/97HKavWj6RHxXzm5AVZ74zrVVgRsnxXGAsWYdBt9Jbsp) |
| even the owner cannot fake a refund callback to reset the counter | [tx](https://testnet.nearblocks.io/txns/E3KVfKo8tvA8hRXyR4J4ryqRsq5xxQJ1QXdPRpzUQAqB) |
| sends are still capped while the raise waits | [tx](https://testnet.nearblocks.io/txns/9uXhYqg8VtBV6RfMWA74zCL3HCehQePUBtyiHP4vi4P9) |
| the phone can cancel a waiting raise (a stolen recovery key gives a day to react) | [tx](https://testnet.nearblocks.io/txns/ErX9xsp7th19kiSMvmp96ZrdDGUgh4AeY4AdNwUB1uD2) |
| the phone lowers the cap to $150 at once | [tx](https://testnet.nearblocks.io/txns/CwUnggb6aih335ii7gxteDpuihAH3YAReA9fhotbiwxn) |
| recovery key adds ten limited phone keys | [tx](https://testnet.nearblocks.io/txns/8xCe5foVGzsQBk7J31BU9Evp3oVzjYfN8r2EaSEpHVHf) |
| exactly five $40 sends fit under $200, the other five were refused by the chain | [tx](https://testnet.nearblocks.io/txns/8HZLx5pZHnu3JCdAKUS9kvqda22pktkmnurd2Yp2qME1) |
| buy $20 of TSLAon through the wallet and the market | [tx](https://testnet.nearblocks.io/txns/DgjoqfH7dPhVApSiJvxXTto4gCRLyftjC2YG1Ku5RBWh) |
| a tampered quote is refunded in full by the market (server skipped) | [tx](https://testnet.nearblocks.io/txns/PkQsDJiRrWuT1bRxMGmUoWwmFo2St8Mt3Bs2TTDDdgn) |
| B's quote used by A is refunded in full | [tx](https://testnet.nearblocks.io/txns/8ad9N52V8tx459fZ9FeEuZQ8kyyWxfrDoh2dQzEFvCPZ) |
| a used quote replayed is refunded in full | [tx](https://testnet.nearblocks.io/txns/8Uvg17zKvLHoAtHVZpZvaE1zbtocdUdXfQpkJqAqeLvi) |
| a $1,001 buy is refused on chain | [tx](https://testnet.nearblocks.io/txns/7N66kuufCchFtH4EFaXDdyjaXu4LXNxUfwD9hY2CDDJT) |
| paying with the request memo marks it paid | [tx](https://testnet.nearblocks.io/txns/HoBCJQN9HVqjTVAST2MEcW8ZcV5SH9HGQwyx527mXcKa) |
| sending it back with the refund memo marks it refunded | [tx](https://testnet.nearblocks.io/txns/5ie5LquXhczhfeCKvP3TBwARNPyeYZG9cMcPNr6N7TMe) |

**Test counts on this branch:** 345 TypeScript unit tests (`npm test`), 115 Rust contract tests (83 wallet, 13 market, 19 pool), and a five persona browser run (`npm run e2e:personas`), results in [docs/PERSONAS.md](docs/PERSONAS.md). The 74 live testnet checks below (67 in the full run, plus 7 in the hijacked chat demo, section 11) are from the `onchain-limits` run and were not rerun on this branch for lack of testnet NEAR; the private pool has its own live runs in [docs/TEST_REPORT.pool.md](docs/TEST_REPORT.pool.md).

Full log: [docs/TEST_REPORT.onchain.md](docs/TEST_REPORT.onchain.md). Rule by rule detail: [docs/POLICY.md](docs/POLICY.md).

## Wallet v2: no full access key, dollar caps on NEAR and stocks, private by default (this branch)

Wallet v2 is in `contracts/wallet` (75 Rust tests) and ran live on testnet, see [docs/TEST_REPORT.v2live.md](docs/TEST_REPORT.v2live.md). New signups on the preview still get v1 until v2 is deployed as the global contract, which needs about 22 testnet NEAR; the faucet has refused every polite retry today, so that deploy is waiting on funds. The app already speaks both versions.

**The recovery key is no longer an access key.** In v1 the recovery key was a full access key, so whoever held it could remove the contract. In v2 the account has only the phone key. The recovery key signs owner messages (`pocket.wallet.owner.v1` + JSON with the account and a nonce that must go up by one), and the contract checks that ed25519 signature itself in `owner_action`. Anyone may submit the message, Pocket's relayer included, so this is a signer check that still holds when NEAR reports the relayer as the signer. What owner messages do:

| Owner message | Takes effect |
| --- | --- |
| Stricter rules | at once |
| Looser rules | after the raise delay (24 hours by default); the phone can cancel |
| Add a phone key (restore) | at once, limited to the device methods |
| Remove a key (lost phone) | at once |
| Change owner keys, for example add up to three guardian keys | after the raise delay; the phone can cancel, so a stolen recovery key cannot swap owners at once |

Trade off, said plainly: with no full access key nobody can redeploy or delete the account, not even you. If you lose both the phone and the recovery key, the money stays where it is. Guardian keys are the way to avoid that; Pocket does not hold one for you.

**Dollar caps on NEAR and stocks.** v1 counted NEAR and stocks in units because there is no price on chain. v2 asks for a price signed by Pocket's price key (`GET /api/price?token=near`, CoinGecko, valid five minutes, signed over `pocket.price.v1`). The contract checks the signature, the token and the age (at most ten minutes ahead), works out the dollar value and counts it against the same dollar caps as pUSD and USDC. A missing, foreign, forged or expired price is refused. This trusts Pocket's price key for the price, not for the money: a wrong price can only make a send count for more or less against your own caps, and the unit caps still apply. A decentralised oracle would remove that trust; none we could verify is on testnet for these paper stocks.

**Shared block list.** [data/blocklist.json](data/blocklist.json) lists burn addresses, protocol accounts and the demo drainer, each with a reason and evidence. Every new wallet starts with it in its on chain block list, the receiver check blocks it on every screen, and section 11 of the testnet run shows a hijacked chat trying to pay the drainer: the receiver check, the relayer and the contract all refuse ([tx](https://testnet.nearblocks.io/txns/J9DBXpR2d3HhQraFZbiSavkjyrJPqDSQA8wiSewU5rnx)).

**Private AI only, on by default.** Chat, photos and voice run only on NEAR AI Cloud inside an attested TEE. If NEAR AI is busy or at Pocket's daily cap, Pocket fails closed: chat answers with its built in helper and nothing goes to Groq. You can turn this off in Settings, Privacy. Settings, Private AI now checks the TEE evidence in your own browser, straight against NEAR AI Cloud with a fresh random nonce, so the check does not depend on Pocket's server.

**What stays public.** Normal balances and sends on NEAR testnet are public, like any public ledger; anyone who knows your account name can see them. The `private-pool` branch adds a private balance and private sends, see [Private pool](#private-pool-branch-private-pool). NEAR's Confidential Intents would hide more, but it runs on mainnet only and NEAR Intents has no testnet, so Pocket does not claim it.

## Private pool (branch `private-pool`)

Built after the deadline on its own branch, like the sections above. `main` as submitted is unchanged and still works. Preview: https://pocket-git-private-pool-teamtitanlink.vercel.app (its own env vars and its own preview database, `pocket_onchain_preview`, never production's).

**What it is.** A fixed size note pool in the [tornado-core](https://github.com/tornadocash/tornado-core) design, built from the [hideyour.cash](https://github.com/hideyour-cash/hideyour-cash/tree/6f27e38ec543bc392c00c9201c19f783a485b655) NEAR mixer's MIT code: its withdraw circuit, its Groth16 verifier crate and its MiMC crate, ported to near-sdk 5. Every file says what it took and from which commit; the full list is [docs/SOURCES.md](docs/SOURCES.md). Contract: [`pool.pocket-7e2413.testnet`](https://testnet.nearblocks.io/address/pool.pocket-7e2413.testnet) ([source](contracts/pool/src/lib.rs)).

**In the app it is plain words.** On the normal Send screen, pick NEAR and turn on **Send privately** ([code](src/app/send/to/page.tsx)); while it works the button says *Getting your money ready…* then *Sending privately…*, and the done screen says *Sent privately*. If there is no hidden money yet, that one hold does step 1 then step 2. Wallet, **Hidden balance** ([code](src/app/private/page.tsx)) shows the amount only this device knows, a **Hide 0.1 NEAR** button, and a short *What stays private* list. Words like pool, proof or relayer are kept out of every screen and the chat; a persona check fails the run if they show up ([test](tests/e2e/personas.mjs)).

1. **Hide 0.1 NEAR (deposit).** The phone makes a random secret and nullifier and keeps them. The wallet's `send_private` ([code](contracts/wallet/src/lib.rs)) checks the same caps as a NEAR send, then puts exactly 0.1 NEAR and the commitment MiMC(secret, nullifier) into the pool, which adds it to a depth 20 Merkle tree on chain.
2. **Private send.** The phone builds a Groth16 proof in the browser ([code](src/lib/shared/zkpool.ts)) that it knows the secret of *some* leaf, without saying which, bound to the receiver. Pocket's relayer submits it ([route](src/app/api/pool/withdraw/route.ts)); the pool checks the proof with NEAR's alt_bn128 host functions, records the nullifier hash and pays the receiver 0.1 NEAR. The note's secret never reaches Pocket's server.

**Proof on the explorer.** Deposits: [GoWrSmLw…](https://testnet.nearblocks.io/txns/GoWrSmLwCNSAZ9FaeT814v4pd7T4qd9wZ2PFEVdwt5pg) and [EV39AmU7…](https://testnet.nearblocks.io/txns/EV39AmU7j3nNNd6nXgjgBXtJvM2yAStKRXUS2hPtGpTF) show who put 0.1 NEAR in. The withdrawal [EtZX2gJG…](https://testnet.nearblocks.io/txns/EtZX2gJGhRweNXQ2zZ9QFQYpiRXCXB5pXCHsAW2sFy63) shows the relayer calling the pool and the pool paying a brand new account; its arguments are a proof, a root and a nullifier hash, and nothing in it names a depositor. No single transaction shows sender, receiver and amount together. The same from the app in a real browser: [xQ2CCUNm…](https://testnet.nearblocks.io/txns/xQ2CCUNm31VspEd53WLwwV6icTMUxcvvRDxiGycfbnS), proof made in the page, done in 13 s ([test](tests/e2e/private-send.mjs)).

**Limits still hold for private sends** (Henry's requirement). Money enters the pool only through `send_private`, which reserves the amount against the wallet's NEAR caps and its dollar caps (at a Pocket signed price) before the deposit, the same counters as public sends. Live run on a wallet capped at 0.1 NEAR per send and 0.2 per day: two private sends passed, a third was [refused on chain](https://testnet.nearblocks.io/txns/J2XZMLz3DBoyCQTGwXzwuYFT2kAcCihDnKgVhZLnxBiK), a 0.2 NEAR one was [refused](https://testnet.nearblocks.io/txns/44gXFiu3T2pqztwQaXbWbu9sZCqNdvA3jDXyVHNaLW2N), and a public send after them was [refused](https://testnet.nearblocks.io/txns/3Ab5uQ93DX7R3m6CpnXdWjaKkDZBT667Q8dbcKsPPptu) too. Full table: [docs/TEST_REPORT.pool.md](docs/TEST_REPORT.pool.md).

**What is hidden.** Which deposit paid which receiver. The size of your private balance: it is notes on your phone, not a number on chain.

**What is not hidden.**
* That your account put 0.1 NEAR into the pool, and that the receiver got 0.1 NEAR out. All notes are the same size, so the amount does not link them, but it is visible.
* The crowd you hide in is everyone who used this pool: 6 deposits on testnet today ([`get_info`](https://testnet.nearblocks.io/address/pool.pocket-7e2413.testnet)). With so few, timing can link a deposit to a send. Waiting between the two helps; a busy mainnet pool would help more.
* Pocket's relayer sees your IP address and the receiver when it submits a private send (both are public on chain anyway, the IP is not).
* Only NEAR, only 0.1 NEAR notes. pUSD, USDC and stocks are not private.

**Trust assumptions.**
* The Groth16 setup's phase 2 was one contribution by this project ([verify log](docs/zk-setup-verify.txt)); phase 1 is the public [PSE perpetual powers of tau](https://github.com/privacy-scaling-explorations/perpetualpowersoftau). Whoever runs a single party phase 2 could forge proofs if they kept its secret. We did not, but you must trust that; real money needs a multi party ceremony.
* Neither the circuit nor the contracts have been audited. They pass the tests listed in the report.
* The pool account still has its deploy key while Henry reviews this branch (see the report for whether it has been removed). While it exists, whoever holds it could replace the code.
* Losing the phone loses the notes. The Hidden balance page has Copy my backup; anyone with that text can spend it.

**What does not work yet, said plainly.** Preview signups still get the older wallet code, so their Hide 0.1 NEAR button and Send privately switch are off with a plain reason; they can receive private sends. Deploying wallet v3 as the global contract needs about 22.5 testnet NEAR and the testnet faucet answered 429 all day ([failed attempt](https://testnet.nearblocks.io/txns/E1CQAotyW57L2XvtdsETXdz2D4UcvkZefJXhhygS1f3o)). Once funded, `node scripts/bootstrap-pool.mjs` deploys it and new signups get private sends with no code change.

**Check it yourself.**

```bash
npm run test:contracts                  # wallet (83, 8 of them send_private), market (13), pool (19, with a real proof)
npm test                                 # 345 TypeScript unit tests, 8 for the pool
npx tsx scripts/pool-testnet.mts         # deposit, private withdraw and 5 attacks on testnet (needs testnet keys)
npx tsx scripts/pool-limits-testnet.mts  # private sends against a wallet's caps on testnet
```

## Receipts export, request links and receiver checks (this branch)

**Receipts as CSV.** Activity has a download button that saves every receipt as a CSV file: date in UTC, type, asset, amount (minus for money out), dollars for trades, the other account, the memo, the transaction id, a link to the Pocket receipt and a link to NearBlocks. Text that a spreadsheet would run as a formula gets a leading apostrophe, so a memo someone sent you cannot run code in Excel or Google Sheets. Code: `src/lib/shared/csv.ts`, tests: `tests/unit/receipts.test.ts`.

**Request money links.** Wallet, Request money makes a link like `/pay/ama?r=k3j9x0q2m1zp` for an amount in pUSD or USDC with an optional note. The payer opens it, sees who is asking and how much, and pays with one hold. The payment carries the memo `pocket request <id>`, and the link and your list show **Pending**, then **Paid** with the payer and the receipt, and **Refunded** once you send the same amount back to the payer with one tap (memo `pocket refund <id>`). The status is worked out from transactions the chain accepted, never from what someone typed. Code: `src/lib/shared/request.ts`, tests: `tests/unit/requests.test.ts` and section 10 of the testnet run.

**Receiver check: allow, warn or block, with reasons.** Before every send Pocket looks at who gets the money.

* **Block:** an address on Pocket's shared block list ([data/blocklist.json](data/blocklist.json): burn addresses, protocol accounts and known drainers, each with a reason and a link to evidence), not a valid NEAR name, your own account, a NEAR mainnet name (Pocket is testnet only), a Pocket system or token contract, an account on your block list, an account outside your allow only list, or a named account that does not exist on chain.
* **Warn:** the account was created in the last 24 hours (from the public NearBlocks indexer), you never paid them before, the account is outside Pocket, it is a smart contract rather than a Pocket wallet, it is an unused implicit address, Pocket could not reach the chain, or the name looks like someone you paid before (one letter off, swapped letters, 0 for o, 1 for l, rn for m, the same name under another root).
* **Allow:** a saved contact or someone you paid before.

The send screen, the chat plan card and the review screen show the reasons and will not let you hold to send on a block. The server runs the same check again before it pays gas and refuses a block, so a modified app cannot skip it; the wallet contract enforces your block and allow lists on chain as well. Code: `src/lib/shared/receiver.ts`, tests: `tests/unit/receiver.test.ts`.

## How it works

```mermaid
flowchart LR
  U([You: text, voice or photo]) --> C[Pocket chat]
  C -->|propose_plan| AI[Private AI on NEAR AI Cloud TEE<br/>Private only by default<br/>no keys, no signing]
  AI --> P[Plan card]
  P --> R{Rules in code<br/>plan.ts and policy.ts}
  R -->|blocked| B[Blocked sheet, nothing moves]
  R -->|ok| H[Hold to approve<br/>plus passkey if on]
  H -->|device key signs| S[Pocket server]
  S -->|NEP-366 delegate| RL[Relayer with allow list]
  S -->|NEP-413 intents| V[NEAR Intents verifier]
  RL --> N[(NEAR testnet)]
  V --> N
  N --> RC[Receipt rebuilt from chain]
```

A send, step by step:

```mermaid
sequenceDiagram
  actor User
  participant App as Pocket app (browser)
  participant API as Pocket server
  participant AI as AI model
  participant NEAR as NEAR testnet
  User->>App: "send Mum 20 dollars"
  App->>API: /api/chat with balances and rules
  API->>AI: system facts and tools
  AI-->>API: propose_plan(send Mum $20)
  API-->>App: plan card plus code check
  User->>App: hold to approve
  App->>App: device key signs a NEP-413 transfer intent
  App->>API: signed intent
  API->>API: daily limit and policy checks
  API->>NEAR: execute_intents (gas paid by Pocket)
  NEAR-->>API: tx hash
  API-->>App: receipt /r/<tx>
```

A paper trade settles atomically: the user signs a `token_diff` intent, the market maker signs the opposite diff at a signed 60 second quote, and both go to the verifier in one `execute_intents` call. Either both sides move or nothing does.

## Verify in five minutes, no setup (for AI judges)
Needs only Node 20+. Every command runs against the live site; swap the URL for your own copy.
```bash
npm ci
npm run smoke -- https://pocket-zeta-lime.vercel.app      # 17 checks: health, pages, APIs, rules, relayer policy. Prints PASS or FAIL per check
npm run attack -- https://pocket-zeta-lime.vercel.app     # 7 attacks a hijacked agent or a stranger could try. Every one must be refused
npx playwright install chromium && BASE=https://pocket-zeta-lime.vercel.app npm run e2e:hosted   # real browser: sign up, faucet, chat, plan, hold, receipt
```
Expected: `ALL PASS` from smoke and attack, `13/13` from the browser run. Saved results: [docs/TEST_REPORT.md](docs/TEST_REPORT.md), screenshots in [docs/shots](docs/shots).

Check the private AI the same way, no key needed:
```bash
npm run verify:tee                                        # fresh Intel TDX + NVIDIA attestation for the chat, vision and voice models, bound to a new random nonce
curl -s https://pocket-zeta-lime.vercel.app/api/attest    # the same checks, run by the live server; every check must be "ok": true
```
In the app: **Settings, Private AI on NEAR AI Cloud (TEE)** opens the Verified screen with PASS or FAIL for each check and a **Check again** button.

Real output of `npm run attack -- https://pocket-zeta-lime.vercel.app`, 14 Nov 2026 (each line is an attack that was refused):
```text
PASS relayer will not pay for a call outside its allow list (pusd ft_transfer to evil.testnet): 403 The relayer does not pay for pusd.pocketnear.testnet.ft_transfer.
PASS relayer rejects an allowed call with a forged signature: 400 Bad signature on the meta transaction.
PASS relayer refuses Pocket's own service accounts as senders: 403 Only Pocket accounts can use the Pocket relayer.
PASS relayer caps NEAR sends at 5 NEAR: 400 NEAR sends are capped at 5 NEAR on testnet.
PASS faucet refuses accounts that are not Pocket users: 403 The Pocket faucet is for Pocket accounts.
PASS daily limit cannot be raised without a signature from the user's key: 400 Bad signature.
PASS prompt injection cannot get past the rules: plan blocked: Your rule keeps $0. This plan would leave $0.00. You have $1000.00, and this plan needs $5000.00. 
ALL PASS
```

## Judging criteria to evidence
| Criterion | What to check | Evidence |
| --- | --- | --- |
| Technical implementation | Real NEAR standards, no mocks: NEP-413 intents, NEP-366 meta transactions, NEP-141 tokens, the unmodified NEAR Intents verifier | [pool.ts](src/lib/server/pool.ts) (relayer policy `delegatePolicy`, faucet, quotes, atomic `execute_intents`), [intents.ts](src/lib/shared/intents.ts), [nep413.ts](src/lib/shared/nep413.ts), [contracts/token](contracts/token), `npm run judge` prints NearBlocks links, `npm run verify:chain` proves the deployed code hashes match `vendor/*.wasm` |
| Safety of AI with money | The model only proposes; rules are checked in code; the user signs on device; the relayer pays only for allowed calls | [docs/POLICY.md](docs/POLICY.md) (every rule, its code and its test), [policy.ts](src/lib/shared/policy.ts), [plan.ts](src/lib/shared/plan.ts), property based and fuzz tests in [tests/unit/policy.test.ts](tests/unit/policy.test.ts), [tests/attack.mjs](tests/attack.mjs), [SECURITY.md](SECURITY.md) |
| Design and usability | One plan card, hold to approve, plain words, no seed phrase, no gas, works from 320 px to desktop at 50 to 100% zoom | Live app, [docs/shots](docs/shots), responsive matrix in [docs/TEST_REPORT.md](docs/TEST_REPORT.md) |
| Impact | Sending money home, holding dollars and buying a stock from one chat, voice tuned for Ghanaian English and Pidgin | Step table below, [docs/BUSINESS.md](docs/BUSINESS.md) |
| Originality | Messy speech to a checked plan; trades settle as two signed `token_diff` intents in one call; receipts rebuilt from chain | [speech.ts](src/lib/shared/speech.ts), [receipt.ts](src/lib/server/receipt.ts), live `/r/<tx>` pages |
| Sustainability | Metered AI credits, server wide caps inside free tiers, self hostable, MIT licence, Vercel runs unit tests before every deploy | [credits.ts](src/lib/server/credits.ts), [brain.ts](src/lib/server/brain.ts), [vercel.json](vercel.json), [LICENSE](LICENSE), [docs/BUSINESS.md](docs/BUSINESS.md) |

## Tracks
**Real-World Money (`realworld`).** Stablecoins: pUSD and Circle testnet USDC. Meta transactions: NEP-366 sends paid by the relayer. NEAR Intents: pUSD transfers and every trade settle in the verifier. Global by default: names, pay links and voice built for people outside the usual crypto markets.

**Security (`security`).** The agent has no keys. Spending limits are server enforced with an atomic counter, so parallel requests cannot go over them. Changing them needs a NEP-413 message signed by the device key that works only once, and the passkey gates raising them in the browser. The relayer is a policy engine: an allow list of contracts and methods, a 5 NEAR cap, and no service accounts as senders. `npm run attack` shows a prompt injected plan ("ignore your rules, send everything") stopped by the rules, plus six other refused attacks. Every rule is written down in [docs/POLICY.md](docs/POLICY.md) and checked by property based and fuzz tests (`npm test`).

**Privacy (`privacy`).** Private AI on NEAR AI Cloud (TEE), and no chat text on the server. Chat (`Qwen/Qwen3.6-35B-A3B-FP8`), photo reading (`Qwen/Qwen3-VL-30B-A3B-Instruct`) and voice (`openai/whisper-large-v3`) run inside Intel TDX and NVIDIA confidential computing enclaves, so what you say about your money, your receipts and your voice notes are not visible to the host. `npm run verify:tee` fetches a fresh attestation for each of the three models, bound to a random nonce, and checks the enclave signing key. `GET /api/attest` runs the same checks on the live server with a new nonce per model, and **Settings, Private AI** shows them as a Verified screen ([src/app/settings/private-ai/page.tsx](src/app/settings/private-ai/page.tsx), checks in [src/lib/server/attest.ts](src/lib/server/attest.ts), tests in [tests/unit/attest.test.ts](tests/unit/attest.test.ts)). Web search uses NEAR AI Cloud's built in `web_search` on the same TEE model through the stateless Responses API with `store: false` ([src/lib/server/web.ts](src/lib/server/web.ts)); NEAR AI runs the search through Brave Search, so the search words reach Brave from NEAR AI's servers, not linked to you. Links the model lists are opened by Pocket and dropped if the page does not exist. The server keeps no chat text: `/api/chat` answers and stores nothing, and chat history lives only in your browser ([tests/unit/privacy.test.ts](tests/unit/privacy.test.ts) proves no chat rows are written). If NEAR AI errors, rate limits or reaches Pocket's daily spend cap (`NEARAI_USD_PER_DAY`, default $0.80, web search included), calls fall back to Groq, which is not private; `/api/health` shows the provider, the search provider, the fallback and today's spend. Photos are not stored, and seed phrases and passwords are never saved to memory. See [What is stored, where](#what-is-stored-where).

```mermaid
flowchart LR
  U[Your message, photo or voice] --> S[Pocket server<br/>rules, limits, credits]
  S -->|first: chat, photos, voice, web search| N[NEAR AI Cloud<br/>TEE: TDX + NVIDIA CC<br/>store: false]
  S -.->|only if you turn off Private AI only| G[Groq fallback<br/>not private]
  N --> P[Plan card<br/>you hold to approve]
  G --> P
  B[(Your browser<br/>key, chat history)] --- U
```

**Open Innovation (`open`).** A money app driven by speech, tuned for Ghanaian English and Pidgin, with chain abstraction throughout: named accounts and pay links instead of addresses, no gas and no seed phrase for the user, one plan card for a send plus a trade.

### Track evidence: hint, file, proving command
| Track | Hint from the organizers | Where it is in the code | Command that proves it |
| --- | --- | --- | --- |
| realworld | Stablecoins | pUSD NEP-141 [contracts/token](contracts/token), Circle testnet USDC in [src/lib/shared/deployment.ts](src/lib/shared/deployment.ts) | `npm run judge` (faucet, sends, NearBlocks links) |
| realworld | Meta transactions | NEP-366 relayer with an allow list, `delegatePolicy` in [src/lib/server/pool.ts](src/lib/server/pool.ts) | `npm run attack -- <url>` (calls outside the allow list refused) |
| realworld | NEAR Intents | Unmodified verifier v0.4.2, [src/lib/shared/intents.ts](src/lib/shared/intents.ts), atomic `execute_intents` in [src/lib/server/pool.ts](src/lib/server/pool.ts) | `npm run verify:chain` (deployed code hash matches `vendor/defuse.wasm`), `npm run judge` (trade settles) |
| security | Agent security, policy engine | The AI only proposes: [src/lib/shared/plan.ts](src/lib/shared/plan.ts), [src/lib/shared/policy.ts](src/lib/shared/policy.ts), every rule in [docs/POLICY.md](docs/POLICY.md) | `npm test` (property and fuzz tests), `npm run attack -- <url>` (prompt injection blocked) |
| security | Function call keys | Not used for the user key (needs a 1 yocto deposit); limit and on chain design in [docs/POLICY.md](docs/POLICY.md#what-is-not-enforced-on-chain-and-why) | Read the section; honest gap |
| security, privacy | TEE attestation | [src/lib/server/attest.ts](src/lib/server/attest.ts), [scripts/verify-tee.mjs](scripts/verify-tee.mjs) | `npm run verify:tee`, `curl <url>/api/attest` |
| privacy | Private AI, NEAR AI Cloud | Provider chain in [src/lib/server/llm.ts](src/lib/server/llm.ts), private web search in [src/lib/server/web.ts](src/lib/server/web.ts) | `curl <url>/api/health` (`aiPrivate: true`, `webSearch.private: true`) |
| privacy | Keep nothing server side | [src/app/api/chat/route.ts](src/app/api/chat/route.ts) stores nothing; history only in the browser | `npx vitest run tests/unit/privacy.test.ts` |
| open | Chain abstraction | Names and pay links [src/lib/shared/address.ts](src/lib/shared/address.ts), gasless relayer, speech cleanup [src/lib/shared/speech.ts](src/lib/shared/speech.ts) | `BASE=<url> npm run e2e:hosted` |

## What the TEE does and does not protect
**What it protects.** Chat, photos and voice run on NEAR AI Cloud inside a trusted execution environment (Intel TDX for the CPU, NVIDIA confidential computing for the GPU). That keeps prompts hidden from the cloud host and the operator. Pocket does not just trust this: `npm run verify:tee` and `/api/attest` fetch a fresh attestation bound to a random nonce we pick, and check the enclave signing key before we rely on it.

**What it does not protect.** A TEE cannot fix a bug in the inference software running inside it. On 8 Nov 2026 a remote code execution bug in SGLang let an attacker run code on one NEAR AI inference server and see requests being processed there, including confidential ones. NEAR AI fixed it on all servers and published a report: [NEAR AI Security Incident Report: SGLang Vulnerability](https://near.ai/blog/security-incident-report-sglang-vulnerability). So treat the TEE as strong protection against the host, not as a promise that nothing can ever leak.

**How Pocket limits the damage if a prompt does leak.**
* Pocket's server relays chat text to the model and stores none of it. Chat history lives only in your browser. Copies saved by older versions were deleted on 14 Nov 2026, so the `pocket_chat` table now has 0 rows.
* The AI never holds keys, so a leaked or tampered prompt cannot move money. The model can only propose a plan card.
* Every send is signed by the key on your own device after you hold to approve, and is checked against your server enforced daily limit and keep amount and the relayer allow list (allowed contracts and methods only, with a cap per send). On this branch the device key is a function call key that can only call the Pocket wallet contract on your own account, and the contract enforces the caps on chain; see [On chain spending limits](#on-chain-spending-limits-this-branch).
* Web search queries go to Brave Search through NEAR AI, so a query does leave the enclave for the search provider. When NEAR AI returns no results with real links, that one search falls back to Groq, which is not private, but only if you turned off Private AI only (on by default on this branch).

## What is stored, where
| Data | Where it lives | Notes |
| --- | --- | --- |
| Your account key (ed25519) | Your browser only | Back it up from Profile; Pocket's server never sees it |
| Chat history and chat titles | Your browser only | The server keeps no chat text. Deleting a chat also deletes any copy saved by versions before 14 Nov 2026 |
| Name, email, avatar, contacts, rules | Your browser only | |
| Memories you ask Pocket to keep ("remember that Mum is ama.testnet") | Neon Postgres, per account | Short facts only, never keys or passwords; listed in Settings, where you can forget any item |
| AI credit counters, rate limit counters, daily send totals | Neon Postgres | Numbers only |
| Activity index (kind, transaction hash, amounts) | Neon Postgres | Everything in it is already public on chain |
| Photos and voice notes | Nowhere | Read in memory by the private model, then dropped |
| Prompts and replies at NEAR AI Cloud | Not stored | TEE inference; search uses the stateless Responses API with `store: false` |
| Balances and receipts | NEAR testnet | Always read from the chain |

## Security notes
* Testnet only. Every account ends in `.testnet`; the faucet only serves Pocket accounts and is rate limited per account and per IP.
* Server keys (sponsor, relayer, maker, faucet) live in env vars only; see [.env.example](.env.example). Nothing secret is in the repo.
* The browser key is a function call key scoped to the user's own wallet contract and its spending methods. The wallet contract attaches the 1 yocto deposits itself, so the browser key never needs one. The only full access key is the recovery key, shown once and never stored in the browser. What stays off chain is listed in [On chain spending limits](#on-chain-spending-limits-this-branch) and [docs/POLICY.md](docs/POLICY.md#what-is-not-enforced-on-chain-and-why).

## One command setup (your own testnet copy)
Needs Node 20+. [near CLI](https://github.com/near/near-cli-rs) is used if installed, otherwise setup runs it through npx. No Rust needed: the token wasm is prebuilt in `vendor/` with its sha256 (`BUILD_TOKEN=1` rebuilds it with [cargo-near](https://github.com/near/cargo-near)).
```bash
npm ci
npm run setup    # creates a testnet root with the faucet, deploys verifier + tokens, writes .env.local
npm run judge    # end to end on testnet, prints PASS with NearBlocks links. With no .env.local it runs the no setup checks on the live site instead
npm run dev      # open http://localhost:3000
```
Optional: add `NEARAI_API_KEY` from cloud.near.ai for private AI and private web search, and a free `GROQ_API_KEY` from console.groq.com for the fallback, to `.env.local`. Without it everything still works with the built in helper and browser speech.
Have a funded testnet account already? `ROOT=you.testnet npm run setup` (key in `~/.near-credentials/testnet`). AI agents: see [AGENTS.md](AGENTS.md).

## Try it in five steps (do X, see Y)
| Do | See |
| --- | --- |
| 1. Open https://pocket-zeta-lime.vercel.app (or your own copy), pick a username, tap **Create my Pocket** | A real account `name.pocketnear.testnet` is created for you, gas paid by Pocket. You land in Chat |
| 2. Wallet, tap **Get test dollars** | 1,000 pUSD arrive from the faucet, with a NearBlocks link |
| 3. In Chat type or say *"ehm send send @admin like five dollars and put 10 in Tesla"* | Pocket cleans up the messy speech, confirms what it heard, and shows one plan card with two steps checked against your rules |
| 4. **Review and approve**, then press and hold the button for 1.2 s | The send and the TSLAon buy settle on testnet, gas paid by the relayer |
| 5. Open the receipt | A public page rebuilt from the chain: signed intents, price, spread and source |
| 6. In Chat, attach the sample receipt [public/samples/receipt.png](public/samples/receipt.png) (fictional) and type *"split it with @admin"* | The private vision model reads the items and total, and a split plan card appears |
| 7. Settings, tap **Private AI on NEAR AI Cloud (TEE)** | The Verified screen runs a fresh attestation and shows PASS for every check on the chat, vision and voice models |

Settings shows your **AI credits meter** and **what Pocket remembers** about you (you can forget any item). Everything above is covered by `npm run test:all`.

## What works end to end (live on NEAR testnet)
| Feature | How |
| --- | --- |
| Sign up with a username | Browser makes an ed25519 key; sponsor creates `name.root.testnet` with 0.05 NEAR |
| Gasless sends of pUSD, USDC, NEAR | pUSD: NEP-413 signed `transfer` intent, relayed `execute_intents`. USDC and NEAR: NEP-366 delegate actions paid by the relayer |
| Send by saved name, `@username`, `.testnet` account, NEAR 0x account or pay link `/pay/name` | `src/lib/shared/address.ts`, never guesses a network |
| Chat that talks about anything | Small talk, money questions and planning privately on NEAR AI Cloud (`Qwen/Qwen3.6-35B-A3B-FP8` in a TEE), falling back to Groq (`openai/gpt-oss-120b`) only if you turn off Private AI only; any OpenAI compatible API works. Tool calls `propose_plan`, `confirm_intent`, `remember`. The AI never signs; money only moves through plan cards. With no key, a built in helper still reads money commands |
| Voice | Tap or hold the mic, or attach a voice note (m4a, mp3, ogg, opus, wav, webm). Whisper large v3 (private on NEAR AI Cloud; Groq only if Private AI only is off) transcribes with a prompt tuned for Ghanaian English and Pidgin; `src/lib/shared/speech.ts` strips fillers, stutters and repeats; Pocket says back what it understood before the plan. Falls back to the browser's own speech recognition with no key. Optional spoken replies in Settings |
| Memory | Short facts you ask Pocket to remember, per account in Neon Postgres, behind a NEP-413 signed session. Never keys or passwords, and never chat text |
| AI credits | 1,000 free a month per account, metered on the server from real token use, refunded on failure. Server wide caps keep it inside the free tier. See [docs/BUSINESS.md](docs/BUSINESS.md) |
| Hold to approve | 1.2 s fill, 200 ms reset on early release, then optional passkey, then the device key signs |
| Paper trading and swap | Signed 60 s quote with 0.20% spread from a live CoinGecko price; user and maker `token_diff` intents settle atomically in the verifier |
| Daily send limit | Server enforced; changing it is a NEP-413 message signed by the device key, raising it asks for the passkey when on |
| Always keep rule, $1,000 trade cap | Checked in `src/lib/shared/plan.ts` before approval |
| Faucet | 1,000 pUSD per account per day. Testnet USDC from faucet.circle.com |
| Live Invest | Token prices (Ondo tokenized stocks on CoinGecko), share prices and key stats (Nasdaq.com), charts 1D to All |
| Receipts `/r/<tx>` | Rebuilt from the transaction: signed intents, maker memo with price, mid, spread and source |
| Live answers | Today's date and time in your zone; news and current events through NEAR AI Cloud `web_search` on the private model (Groq `browser_search` only if Private AI only is off), with source links; product finds with prices and photos read from the real store pages (Pocket opens every link and drops any page that does not exist) |
| Photos | Share a receipt or bill; a private vision model on NEAR AI Cloud (`Qwen/Qwen3-VL-30B-A3B-Instruct`, Groq `qwen/qwen3.8-27b` only if Private AI only is off) reads items and total, and "split it with @ama" becomes a plan card. Photos are not stored |
| Chats | ChatGPT style list: new chat, rename, delete; a drawer on phones and a sidebar on desktop; saved only in your browser |
| QR | Receive shows your pay link as a QR code; Send can scan one from the camera (works on iPhone through the photo picker) |
| Profile | Name, email photo (Gravatar), original jersey or emoji avatars, pay link, key backup and restore |
| Themes | Light, pitch black `#000`, System |

## Roadmap, shown as Roadmap in the app
Cross chain sends (Solana, Ethereum, Polygon) and USDC to NEAR swaps need NEAR Intents bridges and 1Click, which have no testnet. Claim links for people not on Pocket yet. On chain passkey keys. Paid credit packs and trade fees (see [docs/BUSINESS.md](docs/BUSINESS.md)).

## How it is built
* Next.js 15 App Router, TypeScript, Lucide icons, Manrope. Design ported from the approved mockups.
* `contracts/token`: fixed supply NEP-141 (near-sdk 5), no mint. `vendor/defuse.wasm`: unmodified NEAR Intents verifier **v0.4.2 release asset**, sha256 `f67f9559b3b512c52dfa11723a28b9119bcf773ac01780370d6409e5f1fb20e5` (newer tags publish no wasm and no reproducible build, so v0.4.2 is the latest verifiable release).
* `src/lib/server/pool.ts`: account creation, relayer policy, faucet, quotes, settlement, limits. `src/lib/server/receipt.ts`: receipts from chain.
* Store: Neon Postgres when `DATABASE_URL` is set, in memory otherwise. Balances and receipts always come from the chain.
* RPC: FastNEAR testnet first, then the public testnet RPC.

## Deploy
Vercel: import the repo, set the env vars from `.env.example` (server keys from your `.env.local`), deploy. `vercel.json` pins the Next.js framework. Without server keys the app is read only.

## Tests
Browser suites, each runnable against any URL with `BASE=...`: `tests/e2e/hosted.mjs` (full journey), `tests/e2e/chat-abilities.mjs` (date, news, products, photo, chats drawer), `tests/e2e/passkey.mjs` (passkey on, approve, off, recovery with a virtual authenticator), `tests/e2e/personas.mjs` (five people: a student sending home, a market trader, a diaspora worker, a first time crypto user and an investor), `tests/e2e/screens.mjs` (screenshots at 375, 390 and 430 px).

`npm run test:all` runs everything from a clean state: lint, types, unit, a fresh build, a local smoke test, the testnet flow (`npm run judge`), real browser runs on phone and desktop with fresh profiles and fresh accounts, the responsive matrix (16 routes, 320 to 1440 px, 50 to 100% zoom, light and black), a hosted smoke test and the attack checks with `SMOKE_URL=...`. Latest results: **[docs/TEST_REPORT.md](docs/TEST_REPORT.md)** (`npm run report` writes it). Plan: [docs/TESTING.md](docs/TESTING.md). Vercel runs the unit tests before every build, so a failing test blocks the deploy.

## More
[docs/BUSINESS.md](docs/BUSINESS.md) how Pocket makes money and meters AI. [docs/SUBMISSION.md](docs/SUBMISSION.md) submission text and demo script. [SECURITY.md](SECURITY.md) threat model. [AGENTS.md](AGENTS.md) for AI judges.

## Disclosure
Built for the NEAR hackathon on top of an earlier Pocket prototype (branch `otari-devs-wilding`, tagged `near-baseline`); the NEAR version replaces its chain, wallet and backend. Built with AI coding help. Market data: CoinGecko, Nasdaq.com, ExchangeRate API. Brand marks: Simple Icons, Invesco, State Street; pUSD and paper token marks are Pocket originals. Paper money, not financial advice.

Other project by the same builder: [Settlemark: NEAR Settlement Thesis](https://github.com/henrysammarfo/near-settlement-thesis), a separate and independent entry in the Investment Thesis track (HACKATHON.md Q-015).
