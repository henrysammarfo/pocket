# On chain limits: testnet attack run

Branch `onchain-limits`, run on 15 Nov 2026 (Africa/Accra, UTC+0). Root `pocket-7e2413.testnet`, market `market.pocket-7e2413.testnet`, wallet global code hash `C5VZEhzSt5HdEaiR7bFYj1aVZrg6VX9ScQqgFjKoKgAz`. Command: `npm run test:onchain` (`tests/onchain/limits.mts`). Every link opens the transaction on NearBlocks testnet. A refused attack that reached the chain links to the failed transaction, so you can see the contract's panic message there.

**Result: 67 passed, 0 failed.**

```text
Pocket on chain limits, testnet attack run
root pocket-7e2413.testnet wallet code C5VZEhzSt5HdEaiR7bFYj1aVZrg6VX9ScQqgFjKoKgAz market market.pocket-7e2413.testnet

1. signup makes a wallet account with a limited phone key
   A olamwhet7ku.pocket-7e2413.testnet https://testnet.nearblocks.io/txns/8YAuk5sU8yvFsExwFyNBpKTVk3WYXxA53ExnqdKfvDox
  ok account runs the Pocket wallet global contract (code hash matches)
  ok phone key is a function call key for its own account only
  ok phone key may call only the device methods
  ok phone key has a 0.25 NEAR gas allowance, not unlimited
  ok recovery key is the full access key
  ok starting rules are the defaults ($100 a send, $200 a day)
  ok faucet paid 1,000 pUSD into the wallet

2. a normal send through the relayer
  ok send $50 pUSD gasless through the relayer https://testnet.nearblocks.io/txns/4bay1ARGcRwhnpE3LhqfcbyU89eZcUqp244rSHQsGksG
  ok B received $50
  ok the wallet counted $50 against the 24 hour cap

3. replay
  ok the same signed meta transaction sent again is refused: The network rejected it: {"ActionError":{"index":0,"kind":{"DelegateActionInvalidNonce":{"
  ok replayed straight to the chain (server skipped), the chain refuses it (delegate nonce used)
  ok B still has exactly 1,050 after both replays

4. caps, signed by the phone key and sent straight to the chain
  ok a $150 send is refused on chain (per send cap $100) https://testnet.nearblocks.io/txns/5sRzmoSzsDazweLeP9ha2RUy1xHegdoT2MUxvCSYJD2g
  ok refused send changed nothing
  ok $100 send within caps goes through https://testnet.nearblocks.io/txns/7Ng1QTf3HpvGbk9Vog3BhJYUNrZ1yTD8dwLrt3ZQ9Qzt
  ok USDC send fails (no USDC in the account), and the callback gives the reservation back https://testnet.nearblocks.io/txns/7thgniY5Tvm7PQfuYRcWTvQ3QMEiPx8X4vau1vrFdPA8
  ok failed USDC send does not count: still $150 used
  ok next $50 reaches exactly $200 for the day https://testnet.nearblocks.io/txns/GxVRBjw1tkSWfTZkmmjHJePgD37LuXgRuiBHyZy4UbHv
  ok one more micro dollar is refused on chain (24 hour cap $200) https://testnet.nearblocks.io/txns/CdmNtVR3VEtpc9HR9VyJ1Tj9f16Mn6UR3TpKNVYWfdwa
  ok B got exactly $200 in total from A
  ok 1.5 NEAR send refused on chain https://testnet.nearblocks.io/txns/A6LxRaR63K1XJgfypPPZznxGAACTHUvxinw1CEXVwXvh
  ok stock send with no stock is refused and not counted https://testnet.nearblocks.io/txns/FFDZZzsyMXnbta3XQ4iqeJG2NKBn8nkMPdgbQC8mUuJN

5. the limited phone key tries to reach around the wallet
  ok phone key calling USDC directly is refused: INVALID_TRANSACTION{"name":"HANDLER_ERROR","cause":{"info":{},"name":"INVALID_TR
  ok phone key calling the verifier directly is refused
  ok phone key sending NEAR directly is refused
  ok phone key cannot attach a deposit
  ok phone key cannot add a full access key
  ok a NEP-413 intent signed by the phone key is refused (key is not in the verifier): The verifier rejected it: {"ActionError":{"index":0,"kind":{"FunctionCallError":
  ok the verifier holds no key for the account
  ok even through the relayer, the phone key cannot register itself in the verifier

6. changing limits without authority
  ok phone key cannot call propose_limits (not in its method list)
  ok phone key cannot raise through lower_limits https://testnet.nearblocks.io/txns/8PKgQHo3TG57y3xnh941MgUK2FqKBkkAcSMfKgjpeejC
  ok phone key cannot raise through the relayer either
  ok another account's full key cannot change A's rules https://testnet.nearblocks.io/txns/4N1AEwxBNpMKXLTr5U4VzV3P4uBunck7zGFeCYC9KxVu
  ok another account cannot spend from A's wallet https://testnet.nearblocks.io/txns/97HKavWj6RHxXzm5AVZ74zrVVgRsnxXGAsWYdBt9Jbsp
  ok even the owner cannot fake a refund callback to reset the counter https://testnet.nearblocks.io/txns/E3KVfKo8tvA8hRXyR4J4ryqRsq5xxQJ1QXdPRpzUQAqB
  ok recovery key proposes a raise to $5,000 (gasless)
  ok the raise waits about 24 hours
  ok the cap is still $200 right now
  ok sends are still capped while the raise waits https://testnet.nearblocks.io/txns/9uXhYqg8VtBV6RfMWA74zCL3HCehQePUBtyiHP4vi4P9
  ok the phone can cancel a waiting raise (a stolen recovery key gives a day to react) https://testnet.nearblocks.io/txns/ErX9xsp7th19kiSMvmp96ZrdDGUgh4AeY4AdNwUB1uD2
  ok the phone lowers the cap to $150 at once https://testnet.nearblocks.io/txns/CwUnggb6aih335ii7gxteDpuihAH3YAReA9fhotbiwxn

7. race: ten $40 sends at once against a $200 cap
  ok recovery key adds ten limited phone keys https://testnet.nearblocks.io/txns/8xCe5foVGzsQBk7J31BU9Evp3oVzjYfN8r2EaSEpHVHf
   5 of 10 went through, 5 refused by the 24 hour cap
  ok exactly five $40 sends fit under $200, the other five were refused by the chain https://testnet.nearblocks.io/txns/8HZLx5pZHnu3JCdAKUS9kvqda22pktkmnurd2Yp2qME1
  ok B received $200, never more than the $200 cap
  ok the wallet counter equals what actually moved
  ok every send that succeeded moved money, every refused one moved none
  ok five $90 sends through the relayer at once: $180 moved, at most two fit under $200 (2 accepted)

8. trades only with the market, all or nothing
  ok server signs the quote for the market contract
  ok buy $20 of TSLAon through the wallet and the market https://testnet.nearblocks.io/txns/DgjoqfH7dPhVApSiJvxXTto4gCRLyftjC2YG1Ku5RBWh
  ok a tampered quote is refunded in full by the market (server skipped) https://testnet.nearblocks.io/txns/PkQsDJiRrWuT1bRxMGmUoWwmFo2St8Mt3Bs2TTDDdgn
  ok B's quote used by A is refunded in full https://testnet.nearblocks.io/txns/8ad9N52V8tx459fZ9FeEuZQ8kyyWxfrDoh2dQzEFvCPZ
  ok a used quote replayed is refunded in full https://testnet.nearblocks.io/txns/8Uvg17zKvLHoAtHVZpZvaE1zbtocdUdXfQpkJqAqeLvi
  ok a $1,001 buy is refused on chain https://testnet.nearblocks.io/txns/7N66kuufCchFtH4EFaXDdyjaXu4LXNxUfwD9hY2CDDJT

9. new phone with the recovery key
  ok recovery key adds a new limited phone key, gasless
  ok the phone key cannot add keys, even through the relayer

10. receiver check, request money link, receipts CSV
  ok receiver check blocks a Pocket system contract: That is a Pocket system contract, not a person. Money sent there would be stuck.
  ok receiver check blocks an account that does not exist on chain
  ok receiver check warns on a first time receiver
  ok receiver check blocks a mainnet name
  ok the relayer refuses a send to a blocked receiver: Pocket will not send there: That is a Pocket system contract, not a person. Money sent there would be stuck.
  ok a new request is pending
  ok paying with the request memo marks it paid https://testnet.nearblocks.io/txns/HoBCJQN9HVqjTVAST2MEcW8ZcV5SH9HGQwyx527mXcKa
  ok after paying once, the receiver check allows B
  ok sending it back with the refund memo marks it refunded https://testnet.nearblocks.io/txns/5ie5LquXhczhfeCKvP3TBwARNPyeYZG9cMcPNr6N7TMe
  ok receipts CSV for E has 4 rows including the request payment

67 passed, 0 failed
{"accounts":{"A":"olamwhet7ku.pocket-7e2413.testnet","B":"benmwhethcu.pocket-7e2413.testnet","C":"cynmwheuy15.pocket-7e2413.testnet","D":"danmwhevfu7.pocket-7e2413.testnet","E":"elimwhewiff.pocket-7e2413.testnet"},"pass":67,"fail":0}
```
