# Security and threat model

Pocket is a **testnet demo**. Tokens have no value. It never connects to NEAR mainnet: `.near` names are refused, the bootstrap refuses non testnet roots, and every RPC default is testnet.

## Keys
| Key | Where it lives | Can do |
| --- | --- | --- |
| User device key | Browser localStorage, created in the browser | Full access to the user's own `name.root.testnet` account |
| Sponsor (root) | Server env `SPONSOR_PRIVATE_KEY` | Create user sub accounts with 0.05 NEAR |
| Relayer | Server env | Pay gas for NEP-366 delegate actions and `execute_intents` |
| Maker | Server env | Sign the counter side of trades at the quoted price |
| Faucet | Server env | Send 1,000 pUSD per account per day |

No key is ever committed, logged or sent to the client. `.env*` and `.secrets/` are gitignored.

## What stops abuse
* **AI cannot move money.** It returns a plan; the user holds to approve; the device key signs the exact intents shown.
* **Relayer policy** (`relay()` in `pool.ts`): sender must be a Pocket sub account, receiver and methods are allow listed (verifier `add_public_key`, USDC `storage_deposit` and `ft_transfer`, NEAR transfer up to 5), gas up to 50 TGas, deposits capped. The delegate signature and nonce are checked by the NEAR protocol.
* **Intents** are NEP-413 signed with a 32 byte random nonce (never the `0x5628` versioned prefix) and a short deadline. The verifier enforces nonces, so replays fail.
* **Quotes** are HMAC signed, expire in 60 s, and are refused if the price is older than `MAX_PRICE_AGE_SEC`. The maker signs the exact token diff the user signed.
* **Daily limit** is checked on the server for every send. Changing it needs a NEP-413 message signed by the device key; raising it also asks for the passkey when that is on.
* **Rate limits** per IP and per account on signup, faucet and chat.
* Tokens are fixed supply with no mint and no force unregister.

## Known limits, said plainly
* The passkey is a **local approval gate** (WebAuthn user verification in this browser). It is not yet an on chain key; that is on the roadmap.
* The device key in localStorage is as safe as the browser profile. Users can back it up from Profile.
* Without Neon (`DATABASE_URL`) the limit and activity store is in memory per server instance.
* Prices come from CoinGecko (Ondo tokenized stock prices) and Nasdaq.com. Paper money, not advice.

Report issues privately to the repo owner.
