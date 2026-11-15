// Private pool, part three of the testnet bootstrap. Idempotent: safe to run again.
// 1. Creates pool.<ROOT>, deploys vendor/pocket_pool.wasm (sha256 checked) and calls new with a 0.1 NEAR
//    note and public/zk/verification_key.json.
// 2. Deploys the new wallet code (with send_private) as a global contract and records its hash.
// Keys go to POCKET_SECRETS_DIR with mode 600 and are never printed. Testnet only.
// Usage: ROOT=you.testnet POCKET_SECRETS_DIR=../.secrets node scripts/bootstrap-pool.mjs
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
if (dep.root !== ROOT) throw new Error('deployment/testnet.json is for ' + dep.root);
const wasmOf = (name) => {
  const f = path.join(repo, 'vendor', name + '.wasm');
  const want = fs.readFileSync(path.join(repo, 'vendor', name + '.sha256'), 'utf8').trim().slice(0, 64);
  const buf = fs.readFileSync(f);
  if (crypto.createHash('sha256').update(buf).digest('hex') !== want) throw new Error(name + ' wasm sha256 mismatch');
  return { f, buf, hex: want, b58: bs58.encode(Buffer.from(want, 'hex')) };
};
const POOLW = wasmOf('pocket_pool');
const WALLET = wasmOf('pocket_wallet');
const keyStore = new keyStores.UnencryptedFileSystemKeyStore(path.join(os.homedir(), '.near-credentials'));
const near = await connect({ networkId: 'testnet', nodeUrl: RPC, keyStore });
const TGAS = 10n ** 12n;
const txs = [];
const log = (label, hash) => { txs.push({ label, hash }); console.log('  ok', label, hash); };
const exists = async (id) => { try { return await (await near.account(id)).state(); } catch { return null; } };
async function rpc(method, params) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) }).then((x) => x.json());
  if (r.error) throw new Error(JSON.stringify(r.error));
  return r.result;
}

const POOL = 'pool.' + ROOT;
const sf = path.join(SECRETS, POOL + '.json');
if (fs.existsSync(sf)) await keyStore.setKey('testnet', POOL, KeyPair.fromString(JSON.parse(fs.readFileSync(sf, 'utf8')).private_key));
if (!(await exists(POOL))) {
  const kp = KeyPair.fromRandom('ed25519');
  fs.writeFileSync(sf, JSON.stringify({ account_id: POOL, public_key: kp.getPublicKey().toString(), private_key: kp.toString() }), { mode: 0o600 });
  await keyStore.setKey('testnet', POOL, kp);
  log('create ' + POOL, (await (await near.account(ROOT)).createAccount(POOL, kp.getPublicKey(), BigInt(utils.format.parseNearAmount('2.5')))).transaction.hash);
}
const st = await exists(POOL);
if (st.code_hash === '11111111111111111111111111111111') {
  const acct = await near.account(POOL);
  log('deploy ' + POOL, (await acct.deployContract(POOLW.buf)).transaction.hash);
  const vk = JSON.parse(fs.readFileSync(path.join(repo, 'public/zk/verification_key.json'), 'utf8'));
  const { vk_alpha_1, vk_beta_2, vk_gamma_2, vk_delta_2, IC } = vk;
  log('init pool (0.1 NEAR notes)', (await acct.functionCall({ contractId: POOL, methodName: 'new', args: { denomination: utils.format.parseNearAmount('0.1'), vk: { vk_alpha_1, vk_beta_2, vk_gamma_2, vk_delta_2, IC } }, gas: 300n * TGAS })).transaction.hash);
}

let haveGlobal = false;
try { await rpc('query', { request_type: 'view_global_contract_code', finality: 'final', code_hash: WALLET.b58 }); haveGlobal = true; } catch { haveGlobal = false; }
if (!haveGlobal) {
  const [bin, ...pre] = (process.env.NEAR_BIN || 'near').split(' ');
  execFileSync(bin, [...pre, 'contract', 'deploy-as-global', 'use-file', WALLET.f, 'as-global-hash', ROOT, 'network-config', 'testnet', 'sign-with-legacy-keychain', 'send'], { stdio: ['ignore', 'ignore', 'pipe'] });
  log('global wallet code v3 ' + WALLET.b58, 'see ' + ROOT);
}

dep.pool = POOL;
dep.poolWasmSha256 = POOLW.hex;
dep.walletCodeHash = WALLET.b58;
dep.poolTxs = [...(dep.poolTxs || []), ...txs];
fs.writeFileSync(depFile, JSON.stringify(dep, null, 2) + '\n');
console.log('pool', POOL, 'wallet code', WALLET.b58);
