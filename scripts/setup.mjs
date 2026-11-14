// One command setup on NEAR testnet: `npm run setup`.
// 1. Uses ROOT from env if its key is in ~/.near-credentials/testnet, otherwise creates a fresh
//    pocket-xxxx.testnet with the near CLI faucet service.
// 2. Tops ROOT up to about 40 NEAR by creating short lived faucet accounts and deleting them
//    into ROOT (testnet faucet gives about 10 NEAR per account).
// 3. Runs the idempotent bootstrap (verifier, tokens, maker, faucet, relayer) and writes .env.local.
// Keys stay in ~/.near-credentials and ./.secrets (gitignored). Nothing is printed. Testnet only.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const RPC = process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com';
const NEED = Number(process.env.SETUP_MIN_NEAR || 40);
const creds = (a) => path.join(os.homedir(), '.near-credentials/testnet', a + '.json');
// near CLI: a local `near` binary if there is one, otherwise the npm build of near-cli-rs through npx.
let NEAR_BIN = ['near'];
try { execFileSync('near', ['--version'], { stdio: 'ignore' }); } catch {
  try { execFileSync('npx', ['-y', 'near-cli-rs@0.31.1', '--version'], { stdio: 'ignore' }); NEAR_BIN = ['npx', '-y', 'near-cli-rs@0.31.1']; }
  catch { console.error('Could not run near CLI. Install it: https://github.com/near/near-cli-rs (npm i -g near-cli-rs or cargo install near-cli-rs).'); process.exit(1); }
}
const near = (...args) => execFileSync(NEAR_BIN[0], [...NEAR_BIN.slice(1), ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function balance(a) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'view_account', finality: 'final', account_id: a } }) }).then((x) => x.json());
  return r.result ? Number(BigInt(r.result.amount) / 10n ** 21n) / 1000 : null;
}
// Token wasm: the prebuilt vendor/pocket_token.wasm (the exact code deployed on testnet, sha256 in
// vendor/pocket_token.sha256) is used by default, so no Rust toolchain is needed. Set BUILD_TOKEN=1 to
// rebuild it from contracts/token with cargo-near instead.
if (process.env.BUILD_TOKEN === '1') {
  console.log('Building the token contract (cargo near build)…');
  execFileSync('cargo', ['near', 'build', 'non-reproducible-wasm'], { cwd: 'contracts/token', stdio: 'inherit' });
}
let ROOT = process.env.ROOT;
if (!ROOT || !fs.existsSync(creds(ROOT))) {
  ROOT = ROOT || `pocket-${crypto.randomBytes(3).toString('hex')}.testnet`;
  console.log('Creating', ROOT, 'with the testnet faucet…');
  near('account', 'create-account', 'sponsor-by-faucet-service', ROOT, 'autogenerate-new-keypair', 'save-to-legacy-keychain', 'network-config', 'testnet', 'create');
  await sleep(3000);
}
for (let i = 0; i < 8; i++) {
  const bal = (await balance(ROOT)) ?? 0;
  console.log(`${ROOT} has ${bal.toFixed(2)} NEAR`);
  if (bal >= NEED) break;
  const tmp = `pocket-fill-${crypto.randomBytes(4).toString('hex')}.testnet`;
  near('account', 'create-account', 'sponsor-by-faucet-service', tmp, 'autogenerate-new-keypair', 'save-to-legacy-keychain', 'network-config', 'testnet', 'create');
  await sleep(3000);
  near('account', 'delete-account', tmp, 'beneficiary', ROOT, 'network-config', 'testnet', 'sign-with-legacy-keychain', 'send');
  try { fs.unlinkSync(creds(tmp)); } catch { /* fine */ }
  await sleep(2000);
}
const env = { ...process.env, ROOT, NEAR_RPC_URL: RPC };
execFileSync('node', ['scripts/bootstrap-testnet.mjs'], { env, stdio: 'inherit' });
execFileSync('node', ['scripts/write-env.mjs'], { env, stdio: 'inherit' });
console.log(`\nDone. Pocket runs on ${ROOT}. Start it with: npm run dev\nOptional: add AI_API_KEY (NEAR AI Cloud) and DATABASE_URL (Neon) to .env.local.`);
