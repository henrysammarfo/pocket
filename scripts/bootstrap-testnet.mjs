// Bootstrap Pocket Pool on NEAR testnet. Idempotent: safe to run again.
//
// Creates sub accounts of ROOT, deploys the official NEAR Intents verifier
// (unmodified defuse v0.4.2 release wasm, sha256 checked) and the fixed supply
// NEP-141 tokens (pUSD and five paper stock tokens), then funds the maker and
// faucet inside the verifier. New keys are written to POCKET_SECRETS_DIR
// (default ./.secrets, gitignored) with mode 600. Keys are never printed.
//
// Usage: ROOT=pocketnear.testnet node scripts/bootstrap-testnet.mjs
// The ROOT key is read from ~/.near-credentials/testnet (near CLI legacy keychain).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { connect, keyStores, KeyPair, utils } from 'near-api-js';

const NETWORK = 'testnet';
if (process.env.NEAR_NETWORK && process.env.NEAR_NETWORK !== 'testnet') throw new Error('Pocket is testnet only');
const ROOT = process.env.ROOT || 'pocketnear.testnet';
if (!ROOT.endsWith('.testnet')) throw new Error('ROOT must be a .testnet account');
const RPC = process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com';
const SECRETS = path.resolve(process.env.POCKET_SECRETS_DIR || '.secrets');
fs.mkdirSync(SECRETS, { recursive: true, mode: 0o700 });
const here = path.dirname(new URL(import.meta.url).pathname);
const repo = path.resolve(here, '..');

const VERIFIER_WASM = path.join(repo, 'vendor/defuse.wasm');
const VERIFIER_SHA = fs.readFileSync(path.join(repo, 'vendor/defuse.sha256'), 'utf8').trim().slice(0, 64);
// Built from contracts/token when BUILD_TOKEN=1 (cargo near build), otherwise the vendored build, sha256 checked.
const BUILT_TOKEN = path.join(repo, 'contracts/token/target/near/pocket_token.wasm');
const TOKEN_WASM = process.env.BUILD_TOKEN === '1' && fs.existsSync(BUILT_TOKEN) ? BUILT_TOKEN : path.join(repo, 'vendor/pocket_token.wasm');
if (TOKEN_WASM.includes('vendor')) {
  const want = fs.readFileSync(path.join(repo, 'vendor/pocket_token.sha256'), 'utf8').trim().slice(0, 64);
  if (crypto.createHash('sha256').update(fs.readFileSync(TOKEN_WASM)).digest('hex') !== want) throw new Error('token wasm sha256 mismatch');
}

const svgUri = (f) => 'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync(path.join(repo, 'public/brand', f), 'utf8').replace(/<!--.*?-->/gs, '').replace(/\s+/g, ' ').trim()).toString('base64');
const PUSD_ICON = svgUri('pusd.svg');
const PAPER_ICON = svgUri('paper.svg');

export const TOKENS = [
  { sub: 'pusd', symbol: 'pUSD', name: 'Pocket test dollar (testnet, no value)', decimals: 6, supply: '10000000', icon: PUSD_ICON },
  { sub: 'tslaon', symbol: 'TSLAon', name: 'Pocket paper TSLAon, tracks TSLA (testnet, no value)', decimals: 18, supply: '1000000', icon: PAPER_ICON },
  { sub: 'nvdaon', symbol: 'NVDAon', name: 'Pocket paper NVDAon, tracks NVDA (testnet, no value)', decimals: 18, supply: '1000000', icon: PAPER_ICON },
  { sub: 'aaplon', symbol: 'AAPLon', name: 'Pocket paper AAPLon, tracks AAPL (testnet, no value)', decimals: 18, supply: '1000000', icon: PAPER_ICON },
  { sub: 'spyon', symbol: 'SPYon', name: 'Pocket paper SPYon, tracks SPY (testnet, no value)', decimals: 18, supply: '1000000', icon: PAPER_ICON },
  { sub: 'qqqon', symbol: 'QQQon', name: 'Pocket paper QQQon, tracks QQQ (testnet, no value)', decimals: 18, supply: '1000000', icon: PAPER_ICON },
];

const keyStore = new keyStores.UnencryptedFileSystemKeyStore(path.join(os.homedir(), '.near-credentials'));
const near = await connect({ networkId: NETWORK, nodeUrl: RPC, keyStore });
const parse = (n) => BigInt(utils.format.parseNearAmount(String(n)));
const units = (n, d) => (BigInt(n) * 10n ** BigInt(d)).toString();
const TGAS = 10n ** 12n;
const txs = [];
const log = (label, hash) => { txs.push({ label, hash }); console.log('  ok', label, hash); };

async function exists(id) {
  try { return await (await near.account(id)).state(); } catch { return null; }
}
function loadSecret(id) {
  const f = path.join(SECRETS, id + '.json');
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
async function sub(name, amount) {
  const id = `${name}.${ROOT}`;
  const s = loadSecret(id);
  if (s) await keyStore.setKey(NETWORK, id, KeyPair.fromString(s.private_key));
  if (await exists(id)) return id;
  const kp = KeyPair.fromRandom('ed25519');
  fs.writeFileSync(path.join(SECRETS, id + '.json'), JSON.stringify({ account_id: id, public_key: kp.getPublicKey().toString(), private_key: kp.toString() }), { mode: 0o600 });
  await keyStore.setKey(NETWORK, id, kp);
  const r = await (await near.account(ROOT)).createAccount(id, kp.getPublicKey(), parse(amount));
  log('create ' + id, r.transaction.hash);
  return id;
}
async function view(id, method, args = {}) {
  return (await near.account(ROOT)).viewFunction({ contractId: id, methodName: method, args });
}
async function call(signer, contractId, methodName, args, { deposit = 0n, gas = 100n * TGAS } = {}) {
  const r = await (await near.account(signer)).functionCall({ contractId, methodName, args, attachedDeposit: deposit, gas });
  return r.transaction.hash;
}
async function deployOnce(id, wasmPath) {
  const st = await exists(id);
  if (st && st.code_hash !== '11111111111111111111111111111111') return false;
  const r = await (await near.account(id)).deployContract(fs.readFileSync(wasmPath));
  log('deploy ' + id, r.transaction.hash);
  return true;
}

// 1. verifier
const wasm = fs.readFileSync(VERIFIER_WASM);
if (crypto.createHash('sha256').update(wasm).digest('hex') !== VERIFIER_SHA) throw new Error('verifier wasm sha256 mismatch');
const ADMIN = await sub('admin', 0.5);
const VERIFIER = await sub('verifier', 16);
if (await deployOnce(VERIFIER, VERIFIER_WASM)) {
  log('init verifier', await call(VERIFIER, VERIFIER, 'new', { config: { wnear_id: 'wrap.testnet', fees: { fee: 0, fee_collector: ADMIN }, roles: { super_admins: [ADMIN], admins: {}, grantees: {} } } }, { gas: 200n * TGAS }));
}
const MAKER = await sub('maker', 1);
const FAUCET = await sub('faucet', 1);
const RELAYER = await sub('relayer', 4);

// 2. tokens
for (const t of TOKENS) {
  const id = await sub(t.sub, 2.2);
  if (await deployOnce(id, TOKEN_WASM)) {
    log('init ' + t.symbol, await call(id, id, 'new', { owner_id: ROOT, total_supply: units(t.supply, t.decimals), metadata: { spec: 'ft-1.0.0', name: t.name, symbol: t.symbol, icon: t.icon, reference: null, reference_hash: null, decimals: t.decimals } }));
  }
  t.contract = id;
  t.assetId = 'nep141:' + id;
  if (!(await view(id, 'storage_balance_of', { account_id: VERIFIER }))) {
    log('register verifier on ' + t.symbol, await call(ROOT, id, 'storage_deposit', { account_id: VERIFIER, registration_only: true }, { deposit: parse(0.00125) }));
  }
}

// 3. inventory inside the verifier
const bal = async (acct, token) => BigInt(await view(VERIFIER, 'mt_balance_of', { account_id: acct, token_id: token }));
for (const t of TOKENS) {
  const total = BigInt(units(t.supply, t.decimals));
  const rootBal = BigInt(await view(t.contract, 'ft_balance_of', { account_id: ROOT }));
  if (rootBal === 0n) continue;
  if (t.symbol === 'pUSD') {
    if ((await bal(FAUCET, t.assetId)) === 0n) log('deposit pUSD for faucet', await call(ROOT, t.contract, 'ft_transfer_call', { receiver_id: VERIFIER, amount: (total / 2n).toString(), msg: FAUCET }, { deposit: 1n, gas: 150n * TGAS }));
    if ((await bal(MAKER, t.assetId)) === 0n) log('deposit pUSD for maker', await call(ROOT, t.contract, 'ft_transfer_call', { receiver_id: VERIFIER, amount: (total / 4n).toString(), msg: MAKER }, { deposit: 1n, gas: 150n * TGAS }));
  } else if ((await bal(MAKER, t.assetId)) === 0n) {
    log('deposit ' + t.symbol + ' for maker', await call(ROOT, t.contract, 'ft_transfer_call', { receiver_id: VERIFIER, amount: rootBal.toString(), msg: MAKER }, { deposit: 1n, gas: 150n * TGAS }));
  }
}

// 4. register maker and faucet signing keys in the verifier
for (const id of [MAKER, FAUCET]) {
  const pk = loadSecret(id).public_key;
  const has = await view(VERIFIER, 'has_public_key', { account_id: id, public_key: pk });
  if (!has) log('verifier key for ' + id, await call(id, VERIFIER, 'add_public_key', { public_key: pk }, { deposit: 1n }));
}

const out = {
  network: NETWORK, root: ROOT, admin: ADMIN, verifier: VERIFIER, maker: MAKER, faucet: FAUCET, relayer: RELAYER,
  verifierRelease: 'near/intents defuse/v0.4.2 release asset defuse.wasm', verifierWasmSha256: VERIFIER_SHA,
  usdc: '3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af',
  tokens: TOKENS.map(({ icon, sub: _s, supply: _p, ...t }) => t),
  bootstrapTxs: txs, updatedAt: new Date().toISOString(),
};
const prev = fs.existsSync(path.join(repo, 'deployment/testnet.json')) ? JSON.parse(fs.readFileSync(path.join(repo, 'deployment/testnet.json'), 'utf8')) : null;
if (prev && txs.length === 0) out.bootstrapTxs = prev.bootstrapTxs;
fs.writeFileSync(path.join(repo, 'deployment/testnet.json'), JSON.stringify(out, null, 2) + '\n');
console.log('done, wrote deployment/testnet.json');
