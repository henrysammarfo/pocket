# POCKET — page-by-page key acquisition guide

Do these in order. After each key, paste it into this chat **or** add it under Cursor Cloud Agent secrets / Vercel project **pocket** → Settings → Environment Variables (Production + Preview + Development).

Project on Vercel: **pocket** on team **teamtitanlink**  
Direct links:
- Project: [https://vercel.com/teamtitanlink/pocket](https://vercel.com/teamtitanlink/pocket)
- Storage: [https://vercel.com/teamtitanlink/pocket/stores](https://vercel.com/teamtitanlink/pocket/stores)
- Env vars: [https://vercel.com/teamtitanlink/pocket/settings/environment-variables](https://vercel.com/teamtitanlink/pocket/settings/environment-variables)

Neon Marketplace is already installed on this team — you only need to **Create Database** and connect it to `pocket`.

---

## 1) Neon Postgres (`DATABASE_URL`) — required (do this first)

1. Open [https://vercel.com/teamtitanlink/pocket/stores](https://vercel.com/teamtitanlink/pocket/stores)
2. Click **Create Database** (or **Browse Marketplace** → Storage)
3. Choose **Neon** → **Continue**
4. Region: `iad1` (US East) → plan **Free** → **Create**
5. Connect to project **pocket** → check **Production**, **Preview**, **Development** → **Connect**
6. Open [Environment Variables](https://vercel.com/teamtitanlink/pocket/settings/environment-variables) and confirm:
   - `DATABASE_URL` (pooled)
   - `DATABASE_URL_UNPOOLED` (direct)
7. Paste `DATABASE_URL` into this chat (or Cloud Agent secrets) so I can run migration `0002_neon_privy_schema.sql`

---

## 2) Privy (`VITE_PRIVY_APP_ID`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`) — required

1. Open [https://dashboard.privy.io](https://dashboard.privy.io)
2. Sign in → **Create app** (or open existing) → name `POCKET`
3. **Settings** → **Basics**
   - Copy **App ID** → set as both `VITE_PRIVY_APP_ID` and `PRIVY_APP_ID`
4. **Settings** → **Basics** / **App secrets**
   - Reveal **App secret** → `PRIVY_APP_SECRET`
5. **Login methods**: enable **Email** + **Google** (+ Apple optional)
6. **Embedded wallets** → Ethereum → create on login for users without wallets
7. **Chains** → add **Monad Testnet** (chain id `10143`, RPC `https://testnet-rpc.monad.xyz`)
8. **Gas sponsorship / Wallet funding** (if shown) → enable for Monad testnet so users never see gas
9. **Allowed domains** → add your Vercel URL (`https://pocket-….vercel.app`) and `http://localhost:3000`

---

## 3) AgentRouter (`AGENTROUTER_API_KEY`) — required for chat/voice STT

1. Open your AgentRouter dashboard / account page (the portal where your AgentRouter key was issued)
2. Create or copy an API key
3. Set:
   - `AGENTROUTER_API_KEY=<key>`
   - `AGENTROUTER_BASE_URL=https://agentrouter.org/v1` (unless your account shows a different base)
4. Optional: `AGENTROUTER_MODEL=gpt-4o`, `AGENTROUTER_TRANSCRIBE_MODEL=whisper-1`

---

## 4) Monad RPC (`MONAD_RPC_URL`) — recommended

**Fast path (public):**
- Set `MONAD_RPC_URL=https://testnet-rpc.monad.xyz`
- Set `VITE_MONAD_RPC_URL=https://testnet-rpc.monad.xyz`

**Hackathon voucher path (QuickNode Metropolis):**
1. Open the Monad / Metropolis hackathon resources page you were given
2. Redeem QuickNode voucher → create Monad **testnet** endpoint
3. Copy HTTPS URL → `MONAD_RPC_URL` + `VITE_MONAD_RPC_URL`

---

## 5) Envio (`ENVIO_API_TOKEN`, `ENVIO_GRAPHQL_URL`) — for live receipts

1. Open [https://envio.dev](https://envio.dev) → sign in
2. **Create HyperIndex** / open existing indexer for this repo’s `indexer/` folder
3. Deploy against Monad testnet (chain id `10143`)
4. Copy GraphQL endpoint → `ENVIO_GRAPHQL_URL`
5. Account / API → create token → `ENVIO_API_TOKEN`

---

## 6) ElevenLabs (`ELEVENLABS_API_KEY`) — optional TTS

1. Open [https://elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys)
2. **Create API key** → copy → `ELEVENLABS_API_KEY`
3. Voices → pick a voice → copy Voice ID → `ELEVENLABS_VOICE_ID`

---

## 7) Agora Instant Settlement — addresses already in repo

Contracts for Monad testnet are already set in `.env.example` / `src/lib/monad/config.ts`.

If Agora gives you an API key for the hackathon:
1. Open Agora Instant Settlement docs / faucet / partner portal from Metropolis resources
2. Copy API key → `AGORA_API_KEY`
3. Whitelist your Privy embedded wallet addresses if required by their faucet flow

---

## 8) Already available in this environment

These were already present in the agent env (no action unless you want to rotate):
- `TAVILY_API_KEY`
- `TINYFISH_API_KEY`
- `AGENTROUTER_API_KEY` / `AGENTROUTER_BASE_URL` (confirm still valid)

---

## After keys land

1. Paste secrets here or into Vercel env for project **pocket**
2. Tell the agent “keys ready” — migrations (`0002_neon_privy_schema.sql`) will be applied
3. Redeploy Vercel / restart local `npm run dev`
