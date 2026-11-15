# On chain limits: testnet attack run

Branch `onchain-limits`, run on 15 Nov 2026 (Africa/Accra, UTC+0). Root `pocket-7e2413.testnet`, market `market.pocket-7e2413.testnet`, wallet global code hash `C5VZEhzSt5HdEaiR7bFYj1aVZrg6VX9ScQqgFjKoKgAz`. Command: `npm run test:onchain` (`tests/onchain/limits.mts`). Every link opens the transaction on NearBlocks testnet.

**Result: 67 passed, 0 failed.**

```text
Pocket on chain limits, testnet attack run
root pocket-7e2413.testnet wallet code C5VZEhzSt5HdEaiR7bFYj1aVZrg6VX9ScQqgFjKoKgAz market market.pocket-7e2413.testnet

1. signup makes a wallet account with a limited phone key
   A olamwhenffw.pocket-7e2413.testnet https://testnet.nearblocks.io/txns/EEoGBJYyTTWuTWGqrZ8gENujZ7h1TWHp5MAgvDx4rUGT
  ok account runs the Pocket wallet global contract (code hash matches)
  ok phone key is a function call key for its own account only
  ok phone key may call only the device methods
  ok phone key has a 0.25 NEAR gas allowance, not unlimited
  ok recovery key is the full access key
  ok starting rules are the defaults ($100 a send, $200 a day)
  ok faucet paid 1,000 pUSD into the wallet

2. a normal send through the relayer
  ok send $50 pUSD gasless through the relayer https://testnet.nearblocks.io/txns/5oo6dD7qD3wwTTvZiq8mv6nnB391eUa3MNu9J8YjqpLd
  ok B received $50
  ok the wallet counted $50 against the 24 hour cap

3. replay
  ok the same signed meta transaction sent again is refused: The network rejected it: {"ActionError":{"index":0,"kind":{"DelegateActionInvalidNonce":{"
  ok replayed straight to the chain (server skipped), the chain refuses it (delegate nonce used)
  ok B still has exactly 1,050 after both replays

4. caps, signed by the phone key and sent straight to the chain
  ok a $150 send is refused on chain (per send cap $100)
  ok refused send changed nothing
  ok $100 send within caps goes through https://testnet.nearblocks.io/txns/GfHt6LhfgMty9H9a9EWcRrBktfJe1Cy6dRajZ454i7uS
  ok USDC send fails (no USDC in the account), and the callback gives the reservation back
  ok failed USDC send does not count: still $150 used
  ok next $50 reaches exactly $200 for the day
  ok one more micro dollar is refused on chain (24 hour cap $200)
  ok B got exactly $200 in total from A
  ok 1.5 NEAR send refused on chain
  ok stock send with no stock is refused and not counted

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
  ok phone key cannot raise through lower_limits
  ok phone key cannot raise through the relayer either
  ok another account's full key cannot change A's rules
  ok another account cannot spend from A's wallet
  ok even the owner cannot fake a refund callback to reset the counter
  ok recovery key proposes a raise to $5,000 (gasless)
  ok the raise waits about 24 hours
  ok the cap is still $200 right now
  ok sends are still capped while the raise waits
  ok the phone can cancel a waiting raise (a stolen recovery key gives a day to react)
  ok the phone lowers the cap to $150 at once

7. race: ten $40 sends at once against a $200 cap
  ok recovery key adds ten limited phone keys
   5 of 10 went through, 5 refused by the 24 hour cap
  ok exactly five $40 sends fit under $200, the other five were refused by the chain
  ok B received $200, never more than the $200 cap
  ok the wallet counter equals what actually moved
  ok every send that succeeded moved money, every refused one moved none
  ok five $90 sends through the relayer at once: $90 moved, at most two fit under $200 (1 accepted)

8. trades only with the market, all or nothing
  ok server signs the quote for the market contract
  ok buy $20 of TSLAon through the wallet and the market https://testnet.nearblocks.io/txns/5bbzbSjudbhTiNFCA31s1tZUnmkwm6jmmdw1jN87mrza
  ok a tampered quote is refunded in full by the market (server skipped)
  ok B's quote used by A is refunded in full
  ok a used quote replayed is refunded in full
  ok a $1,001 buy is refused on chain

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
  ok paying with the request memo marks it paid https://testnet.nearblocks.io/txns/3XgXvmix7kspgCtcLDQpoDaZ5CAGp6TFFepXjtqz4Ugi
  ok after paying once, the receiver check allows B
  ok sending it back with the refund memo marks it refunded https://testnet.nearblocks.io/txns/Haq6fkQsPJvi37hsecZF4zXf3nZddXd5pemokFVUSHEy
  ok receipts CSV for E has 4 rows including the request payment

67 passed, 0 failed
{"accounts":{"A":"olamwhenffw.pocket-7e2413.testnet","B":"benmwhenpgj.pocket-7e2413.testnet","C":"cynmwhep886.pocket-7e2413.testnet","D":"danmwhepqe0.pocket-7e2413.testnet","E":"elimwheqs5q.pocket-7e2413.testnet"},"pass":67,"fail":0}
```
