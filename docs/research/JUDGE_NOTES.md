# Judge notes (internal research, not part of the pitch)

Who reviews NEAR HACKATHON entries, what they keep saying in public, and where Pocket meets it. Every quote links to its source. Collected 14 Nov 2026 from nearhackathon.com, HACKATHON.md, the track prompts and the judges' posts on X.

## The judges (from nearhackathon.com, "Meet the judges")

| Judge | Org | X |
| --- | --- | --- |
| Illia Polosukhin | NEAR Protocol | [@ilblackdragon](https://x.com/ilblackdragon) |
| Eddy Lazzarin | a16z crypto | [@eddylazzarin](https://x.com/eddylazzarin) |
| Mert Mumtaz | Helius | [@0xMert_](https://x.com/0xMert_) |
| Avichal Garg | Electric Capital | [@avichal](https://x.com/avichal) |
| Kain Warwick | Synthetix and Infinex | [@kain](https://x.com/kain) |
| Haseeb Qureshi | Dragonfly | [@hosseeb](https://x.com/hosseeb) |
| Stepan Gershuni | cyber•Fund | [@cyntro_py](https://x.com/cyntro_py) |
| Claude Code and Codex | Anthropic and OpenAI | screening only |

Ecosystem partners listed: NEAR Intents, Aurora, HOT, Rhea, meme.cooking, HEX, NEAR.AI, SVRN, Trezu, SputnikDAO, OutLayer, GoMining, Agent Market, NEAR Builders, Gulf Labs, BRRRAIN, NEAR Business.

## How judging works (HACKATHON.md)

* Claude Code and Codex screen every project: "reproducibility check, feature verification, structured report, preliminary score. Humans decide; low AI score alone cannot reject" (Q-017).
* The README should be written "for a machine reader as well as a human one ... how to try it as 'do X - see Y' steps ... No marketing."
* Testnet only projects are eligible in all tracks (Q-010). Intents has no testnet (Q-007).
* Hosted demo is a plus; keep it up to 18 Nov, ideally 25 Nov (Q-012).
* 1,393 projects were in the public directory on 14 Nov: 318 tagged realworld, 603 security, 574 agents, 324 open.

## What the track prompts ask for

* **Security** ([06-security.md](https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/06-security.md)): "Lean on: Agent security, function-call keys, TEE attestation". The example asks for an agent that "signs with a function-call access key scoped to one contract, never a full-access key. Explain the limits of that key in the README" and "An attack demo ... Show the log."
* **Real-World Money** ([08-realworld.md](https://github.com/nearai/near-hackathon-prompt-examples/blob/main/tracks/08-realworld.md)): "Something a normal company could use tomorrow." Lean on stablecoins, NEAR Intents, meta transactions. A relayer "that only pays for calls to our own contract." Status a user can trust "with links to the transactions."

## Recurring themes, with sources

| Theme | Quote and source | Where Pocket meets it | Gap |
| --- | --- | --- | --- |
| User owned AI | Illia: "It's critical that this future Operating System is User-Owned: private, aligned with the user's success" ([post](https://x.com/ilblackdragon/status/2047706439620464735)). NEAR AI: "Own the agent. Verify the compute." ([post](https://x.com/near_ai/status/2095148778965680243)) | The AI never holds keys; the user's device key signs; memory is per account and can be forgotten | Default model is Groq, not private |
| Private and verifiable inference | Illia: "it's critical that AI is utilized in a user-owned way" about NEAR AI Cloud in Brave ([post](https://x.com/ilblackdragon/status/2110780974523130105)). NEAR: "Privacy for AI and finance is a precondition for a user-owned agent economy." ([post](https://x.com/NEARProtocol/status/2120563263654223993)) | `AI_PROVIDER=nearai` switches chat and voice to NEAR AI Cloud. `npm run verify:tee` checks a fresh Intel TDX and NVIDIA attestation for the model, bound to our nonce and the enclave signing key | The NEAR AI key on the server has no credits (HTTP 402), so the live site still uses Groq |
| Confidential stablecoin settlement | Illia: "Confidential stablecoin settlement is a baseline requirement for agentic commerce." ([post](https://x.com/ilblackdragon/status/2054959684587586005)) | Pocket settles in the Intents verifier | Balances are public on testnet; Confidential Intents not used |
| AI as the interface, chain as trust | Illia: "AI as interface, the intelligence layer. While blockchain provides markets, identity and trust." ([post](https://x.com/ilblackdragon/status/2102742131777413274)) and "AI becoming the interface for computing and business" ([post](https://x.com/ilblackdragon/status/2062434240856199430)) | Chat and voice are the interface; the verifier, named accounts and receipts rebuilt from chain are the trust | None |
| Chain abstraction | Illia: "Now with Intents Connect you can just build apps that target user with any wallet and assets on any chain." ([post](https://x.com/ilblackdragon/status/2100787148123185402)) | Names, pay links, gasless sends; the user never sees gas | Cross chain sends are roadmap (1Click is mainnet only) |
| Distribution | Illia: "Building itself got easier too, so it's really about what to build and how stand out to get distribution." ([post](https://x.com/ilblackdragon/status/2106269343881519444)) | docs/BUSINESS.md; voice for Ghanaian English and Pidgin targets a market others ignore | No users yet; plan for 100 users by end of January |
| Ideas Illia asked for | "Universal checkout widget: any merchant/app can add a 'checkout' button that enables paying with Intents" ([post](https://x.com/ilblackdragon/status/2118027843980366222)) | Pay links `/pay/name` are a start | Not a merchant widget |
| Stablecoins as payment plumbing | Haseeb: "Stablecoins are better plumbing for payments, but you'll only get why if you understand how the existing system works" ([post](https://x.com/hosseeb/status/2089005762282684731)) | Remittance first use case, fees and spread shown on every receipt | None |
| Consumer grade wallet UX | Eddy, on the wallet he rates best: "insanely fast ... comically cheap ... easy mobile UI, anybody can use" ([post](https://x.com/eddylazzarin/status/2112596535485583623)) | Gasless, no seed phrase, hold to approve, works from 320 px | Mobile spacing being fixed on the UI branch |
| Supply chain risk | Eddy: "the risk of a supply chain attack will often exceed the risk of a coding agent making a new vulnerability." ([post](https://x.com/eddylazzarin/status/2118488295541969334)) | Unmodified verifier wasm pinned by sha256; `npm run verify:chain` proves the deployed code hash; `npm ci` from a lockfile | No SBOM or dependency audit in CI |
| Everything gets attacked | Stepan: "realistic world model now: anything that can be hacked will be hacked" ([post](https://x.com/cyntro_py/status/2115932737819599092)) | `npm run attack`, docs/POLICY.md, property and fuzz tests | Limits are not yet on chain |
| Defensible as models get cheaper | Stepan: "Models will get many times smarter and cheaper. The question is how to build a company that wins from that and is defensible." ([post](https://x.com/cyntro_py/status/2082145769252073535)) | The moat is the checked plan, policy engine and local voice, not the model; any OpenAI compatible model works | Say this in the pitch |
| Charge for scarce resources | Kain: "If you don't properly charge for a scarce resource it will be squandered by those who don't value it." ([post](https://x.com/kain/status/2054689783407071660)) | Metered AI credits, 1,000 free a month, paid packs on the roadmap | None |
| Agents that run your accounts | Eddy, quoting a post warning about AI agents in bank accounts: "This reminds me to set up Mercury CLI so my agents can managing my accounts directly (without computer use)." ([post](https://x.com/eddylazzarin/status/2113374791382229177)) | Pocket's AI already turns a sentence into a checked plan; the relayer policy is the guardrail an outside agent would also go through | No public agent API or MCP server yet |
| Open standards for agent payments | Illia: "Open standards are required for an open agent economy" (x402) ([post](https://x.com/ilblackdragon/status/2077151373339062576)) | Not used | x402 is roadmap |

Mert Mumtaz had no matching original posts in the search window, so nothing is quoted for him. Avichal Garg's recent posts are mostly about AI infrastructure and open weight models ([post](https://x.com/avichal/status/2113307466008248807)); the theme is open models, which Pocket supports through any OpenAI compatible endpoint.

## Gap list, by score per hour

1. **Turn on private inference live.** Claim the $10 NEAR AI credits at https://nearbuilders.org/dashboard (Henry), put the key in Vercel as `NEARAI_API_KEY` with `AI_PROVIDER=nearai`, redeploy, then run `npm run verify:tee`. Pocket then matches the NEAR AI themes end to end.
2. **Say it in their words.** README and the submission idea text: "user owned", "the AI never holds the keys", "verified compute", "anything that can be hacked will be hacked, so every rule is in code, written down and attacked".
3. **On chain limits with a function call spending key** (docs/POLICY.md design). Too big to ship safely today; it is the top roadmap item.
4. **Confidential Intents and 1Click cross chain sends** on mainnet with tiny amounts after the hackathon.
