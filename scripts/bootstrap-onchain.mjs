// On chain limits, part two of the testnet bootstrap. Idempotent: safe to run again.
// 1. Deploys the Pocket wallet code (vendor/pocket_wallet.wasm, sha256 checked) once as a NEAR
//    global contract by code hash, so every new account can use it for a few bytes of storage.
// 2. Creates market.<ROOT> and deploys the Pocket maker contract (vendor/pocket_maker.wasm), which
//    settles paper trades inside the verifier against quotes signed by a new quote key.
// 3. Moves half of the maker account's inventory to market.<ROOT> inside the verifier.
// Keys are written to POCKET_SECRETS_DIR with mode 600 and never printed. Testnet only.
// Usage: ROOT=you.testnet POCKET_SECRETS_DIR=.secrets node scripts/bootstrap-onchain.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import bs58 from 'bs58';
import { connect, keyStores, KeyPair, utils } from 'near-api-js';

const ROOT = process.env.ROOT;
if (!ROOT || !ROOT.endsWith('.testnet')) throw new Error('ROOT must be a .testnet account');
const RPC = process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com';
const SECRETS = path.resolve(process.env.POCKET_SECRETS_DIR || '.secrets');
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const depFile = path.join(repo, 'deployment/testnet.json');
const dep = JSON.parse(fs.readFileSync(depFile, 'utf8'));
if (dep.root !== ROOT) throw new Error('deployment/testnet.json is for ' + dep.root + ', run bootstrap-testnet.mjs first');

const wasmOf = (name) => {
  const f = path.join(repo, 'vendor', name + '.wasm');
  const want = fs.readFileSync(path.join(repo, 'vendor', name + '.sha256'), 'utf8').trim().slice(0, 64);
  const buf = fs.readFileSync(f);
  if (crypto.createHash('sha256').update(buf).digest('hex') !== want) throw new Error(name + ' wasm sha256 mismatch');
  return { f, buf, hex: want, b58: bs58.encode(Buffer.from(want, 'hex')) };
};
const WALLET = wasmOf('pocket_wallet');
const MAKERW = wasmOf('pocket_maker');

const keyStore = new keyStores.UnencryptedFileSystemKeyStore(path.join(os.homedir(), '.near-credentials'));
const near = await connect({ networkId: 'testnet', nodeUrl: RPC, keyStore });
const TGAS = 10n ** 12n;
const txs = [];
const log = (label, hash) => { txs.push({ label, hash }); console.log('  ok', label, hash); };
const loadSecret = (id) => { const f = path.join(SECRETS, id + '.json'); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; };
const saveKey = (id, kp) => fs.writeFileSync(path.join(SECRETS, id + '.json'), JSON.stringify({ account_id: id, public_key: kp.getPublicKey().toString(), private_key: kp.toString() }), { mode: 0o600 });
async function rpc(method, params) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }).then((x) => x.json());
  if (r.error) throw new Error(JSON.stringify(r.error));
  return r.result;
}
const exists = async (id) => { try { return await (await near.account(id)).state(); } catch { return null; } };
const view = (id, m, a = {}) => near.account(ROOT).then((x) => x.viewFunction({ contractId: id, methodName: m, args: a }));
const call = async (signer, contractId, methodName, args, { deposit = 0n, gas = 100n * TGAS } = {}) =>
  (await (await near.account(signer)).functionCall({ contractId, methodName, args, attachedDeposit: deposit, gas })).transaction.hash;

// 1. global wallet code
let haveGlobal = false;
try { await rpc('query', { request_type: 'view_global_contract_code', finality: 'final', code_hash: WALLET.b58 }); haveGlobal = true; } catch { haveGlobal = false; }
if (!haveGlobal) {
  const [bin, ...pre] = (process.env.NEAR_BIN || 'near').split(' ');
  execFileSync(bin, [...pre, 'contract', 'deploy-as-global', 'use-file', WALLET.f, 'as-global-hash', ROOT, 'network-config', 'testnet', 'sign-with-legacy-keychain', 'send'], { stdio: ['ignore', 'ignore', 'pipe'] });
  log('global wallet code ' + WALLET.b58, 'see ' + ROOT);
}

// 2. market (maker contract) and its quote key
const MARKET = 'market.' + ROOT;
let quote = loadSecret('quote.' + ROOT);
if (!quote) { const kp = KeyPair.fromRandom('ed25519'); saveKey('quote.' + ROOT, kp); quote = loadSecret('quote.' + ROOT); }
let mk = loadSecret(MARKET);
if (mk) await keyStore.setKey('testnet', MARKET, KeyPair.fromString(mk.private_key));
if (!(await exists(MARKET))) {
  const kp = KeyPair.fromRandom('ed25519');
  saveKey(MARKET, kp);
  await keyStore.setKey('testnet', MARKET, kp);
  log('create ' + MARKET, (await (await near.account(ROOT)).createAccount(MARKET, kp.getPublicKey(), BigInt(utils.format.parseNearAmount('3')))).transaction.hash);
}
const st = await exists(MARKET);
if (st.code_hash === '11111111111111111111111111111111') {
  log('deploy ' + MARKET, (await (await near.account(MARKET)).deployContract(MAKERW.buf)).transaction.hash);
  log('init market', await call(MARKET, MARKET, 'new', { owner: ROOT, verifier: dep.verifier, quote_key: quote.public_key }));
}

// 3. inventory for the market
for (const t of dep.tokens) {
  const have = BigInt(await view(dep.verifier, 'mt_balance_of', { account_id: MARKET, token_id: t.assetId }));
  if (have > 0n) continue;
  const m = BigInt(await view(dep.verifier, 'mt_balance_of', { account_id: dep.maker, token_id: t.assetId }));
  if (m === 0n) continue;
  const mkey = loadSecret(dep.maker);
  await keyStore.setKey('testnet', dep.maker, KeyPair.fromString(mkey.private_key));
  log('inventory ' + t.symbol + ' for market', await call(dep.maker, dep.verifier, 'mt_transfer', { receiver_id: MARKET, token_id: t.assetId, amount: (m / 2n).toString() }, { deposit: 1n, gas: 50n * TGAS }));
}

dep.market = MARKET;
dep.walletCodeHash = WALLET.b58;
dep.walletWasmSha256 = WALLET.hex;
dep.marketWasmSha256 = MAKERW.hex;
dep.quoteKey = quote.public_key;
dep.onchainTxs = [...(dep.onchainTxs || []), ...txs];
fs.writeFileSync(depFile, JSON.stringify(dep, null, 2) + '\n');
console.log('done, wallet code', WALLET.b58, 'market', MARKET);
