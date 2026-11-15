// Testnet proof that private sends obey the wallet's on chain limits. Testnet only; keys are never printed.
// 1. ROOT creates pdemo<N>.<ROOT> in one transaction: wallet code (vendor/pocket_wallet.wasm, with send_private)
//    deployed on the account, a phone (function call) key for the device methods, and `new` with tight NEAR
//    caps: 0.1 NEAR per send, 0.2 NEAR per 24 hours, and pool.<ROOT> as its pool. No full access key is added.
// 2. The phone key calls send_private twice (0.1 NEAR each): both pass and land in the pool.
// 3. A third send_private and a public send_near are refused by the contract (24 hour cap), and an
//    0.2 NEAR private send is refused (per send cap; the pool would refuse it anyway).
// 4. The relayer withdraws one of the notes to a brand new account with a proof.
// Needs QUOTE_PRIVATE_KEY in ENV_FILE (to sign NEAR prices like the server does). Writes docs/pool-limits-testnet.json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { connect, keyStores, KeyPair, utils, transactions } from 'near-api-js';
import { makeNote, proveWithdraw, type Note } from '../src/lib/shared/zkpool';
import { keyFromString } from '../src/lib/shared/nep413';

const envText = fs.readFileSync(process.env.ENV_FILE || '.env.local', 'utf8');
const QUOTE = envText.match(/^QUOTE_PRIVATE_KEY=(.+)$/m)?.[1]?.trim();
if (!QUOTE) throw new Error('QUOTE_PRIVATE_KEY missing');
const SECRETS = path.resolve(process.env.POCKET_SECRETS_DIR || '.secrets');
if (!fs.existsSync(SECRETS)) throw new Error('POCKET_SECRETS_DIR does not exist');
const dep = JSON.parse(fs.readFileSync('deployment/testnet.json', 'utf8'));
const ROOT: string = dep.root, POOL: string = dep.pool;
const RPC = process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com';
const keyStore = new keyStores.UnencryptedFileSystemKeyStore(path.join(os.homedir(), '.near-credentials'));
const mem = new keyStores.InMemoryKeyStore();
const nearFs = await connect({ networkId: 'testnet', nodeUrl: RPC, keyStore });
const nearMem = await connect({ networkId: 'testnet', nodeUrl: RPC, keyStore: mem });
const TGAS = 10n ** 12n;
const NEAR = 10n ** 24n;
const out: { label: string; hash: string; ok: boolean; error?: string }[] = [];
const PRICE_TAG = 'pocket.price.v1\n';
const { ed25519 } = await import('@noble/curves/ed25519.js');
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

async function nearUsd(): Promise<number> {
  const j = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=near&vs_currencies=usd').then((r) => r.json()).catch(() => null);
  return j?.near?.usd || 2;
}
function price(usd: number) {
  const payload = JSON.stringify({ v: 1, token: 'near', micro_usd: String(Math.round(usd * 1e6)), decimals: 24, expires_ms: Date.now() + 5 * 60_000 });
  return { payload, signature: hex(ed25519.sign(new TextEncoder().encode(PRICE_TAG + payload), keyFromString(QUOTE!).seed)) };
}
const save = (name: string, v: unknown) => fs.writeFileSync(path.join(SECRETS, name), JSON.stringify(v), { mode: 0o600 });

async function run(label: string, f: () => Promise<{ transaction: { hash: string }; receipts_outcome: unknown[] }>, expectFail = false) {
  try {
    const r = await f();
    const failed = JSON.stringify(r.receipts_outcome).includes('"Failure"');
    out.push({ label, hash: r.transaction.hash, ok: !failed });
    console.log(failed ? (expectFail ? '  refused as expected' : '  FAILED') : '  ok', label, r.transaction.hash);
    return r;
  } catch (e) {
    const err = e as { context?: { transactionHash?: string }; transaction_outcome?: { id: string }; message: string };
    const hash = err.transaction_outcome?.id || err.context?.transactionHash || '';
    out.push({ label, hash, ok: false, error: err.message.slice(0, 200) });
    console.log(expectFail ? '  refused as expected' : '  ERROR', label, hash, err.message.slice(0, 140));
    if (!expectFail) throw e;
    return null;
  }
}

// PDEMO=<account> reuses a demo wallet made by an earlier run (its keys are in POCKET_SECRETS_DIR).
const reuse = process.env.PDEMO;
const id = reuse || `pdemo${Date.now().toString(36)}.${ROOT}`;
const old = reuse ? JSON.parse(fs.readFileSync(path.join(SECRETS, `${id}.keys.json`), 'utf8')) : null;
const owner = old ? KeyPair.fromString(old.owner_private_key) : KeyPair.fromRandom('ed25519');
const phone = old ? KeyPair.fromString(old.phone_private_key) : KeyPair.fromRandom('ed25519');
if (!old) save(`${id}.keys.json`, { account_id: id, owner_private_key: owner.toString(), phone_private_key: phone.toString() });
await mem.setKey('testnet', id, phone);
const methods = ['send_near', 'send_usdc', 'send_token', 'trade', 'lower_limits', 'cancel_pending', 'owner_action', 'send_private'];
const ZERO = '0';
const limits = {
  usd_per_send: String(100n * 10n ** 6n), usd_per_day: String(200n * 10n ** 6n),
  near_per_send: String(NEAR / 10n), near_per_day: String(NEAR / 5n),
  token_caps: [], max_trade_usd: ZERO, allow_near: true, allow_usdc: false, allow_tokens: false, allow_trade: false,
  allow_only: null, blocked: [], raise_delay_sec: 86400,
};
const wasm = fs.readFileSync('vendor/pocket_wallet.wasm');
const quotePub = 'ed25519:' + (await import('bs58')).default.encode(ed25519.getPublicKey(keyFromString(QUOTE).seed));
const rootAcct = await nearFs.account(ROOT);
if (!reuse) await run(`create ${id} with the wallet code, a phone key and tight NEAR caps (no full access key)`, () => rootAcct.signAndSendTransaction({
  receiverId: id,
  actions: [
    transactions.createAccount(),
    transactions.transfer(BigInt(utils.format.parseNearAmount('2.65')!)),
    transactions.deployContract(wasm),
    transactions.addKey(phone.getPublicKey(), transactions.functionCallAccessKey(id, methods, BigInt(utils.format.parseNearAmount('0.25')!))),
    transactions.functionCall('new', { owner_keys: [owner.getPublicKey().toString()], verifier: dep.verifier, usdc: dep.usdc, maker: dep.market, dollar_tokens: [], limits, price_key: quotePub, pool: POOL }, 50n * TGAS, 0n),
  ],
}) as never);

const usd = await nearUsd();
const me = await nearMem.account(id);
const call = (method: string, args: object) => me.functionCall({ contractId: id, methodName: method, args, gas: 200n * TGAS, attachedDeposit: 0n }) as never;
// Notes are appended, never overwritten, so a rerun cannot lose an earlier note.
const notesFile = path.join(SECRETS, `${id}.notes.json`);
const notes: Note[] = fs.existsSync(notesFile) ? JSON.parse(fs.readFileSync(notesFile, 'utf8')) : [];
for (let i = 1; i <= (process.env.SKIP_SENDS ? 0 : 2); i++) {
  const n = await makeNote(POOL, String(NEAR / 10n));
  await run(`private send ${i} of 0.1 NEAR through the wallet (send_private)`, () => call('send_private', { commitment: n.commitment, amount: String(NEAR / 10n), price: price(usd) }));
  notes.push(n);
  save(`${id}.notes.json`, notes);
}
const n3 = await makeNote(POOL, String(NEAR / 10n));
await run('attack: a third private send in the same 24 hours (over the 0.2 NEAR daily cap)', () => call('send_private', { commitment: n3.commitment, amount: String(NEAR / 10n), price: price(usd) }), true);
await run('attack: a public send_near after the cap is used up', () => call('send_near', { receiver_id: dep.relayer, amount: String(NEAR / 100n), price: price(usd) }), true);
await run('attack: one private send of 0.2 NEAR (over the 0.1 NEAR per send cap)', () => call('send_private', { commitment: n3.commitment, amount: String(NEAR / 5n), price: price(usd) }), true);
await run('attack: private send without a Pocket signed price (the cap is checked first, so this shows the cap or the price refusal)', () => call('send_private', { commitment: n3.commitment, amount: String(NEAR / 10n) }), true);

const spent = await me.viewFunction({ contractId: id, methodName: 'get_spent', args: {} });
const view = async (m: string, a: object = {}) => {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'call_function', finality: 'optimistic', account_id: POOL, method_name: m, args_base64: Buffer.from(JSON.stringify(a)).toString('base64') } }) }).then((x) => x.json());
  return JSON.parse(Buffer.from(r.result.result).toString());
};
const leaves = (await view('get_leaves', { from: 0, limit: 500 })).map((x: string) => BigInt(x));
const fresh = crypto.randomBytes(32).toString('hex');
const w = await proveWithdraw(notes[notes.length - 1], leaves, fresh, null, 0n, 'public/zk/withdraw.wasm', 'public/zk/withdraw.zkey');
const rel = await nearFs.account(dep.relayer);
await run(`relayer pays one of those notes to a new account ${fresh.slice(0, 8)}…`, () => rel.functionCall({ contractId: POOL, methodName: 'withdraw', args: { ...w, fee: '0' }, gas: 300n * TGAS, attachedDeposit: 0n }) as never);

const prev = fs.existsSync('docs/pool-limits-testnet.json') ? JSON.parse(fs.readFileSync('docs/pool-limits-testnet.json', 'utf8')).txs : [];
out.unshift(...(process.env.PREV_TXS ? JSON.parse(process.env.PREV_TXS) : []), ...(process.env.SKIP_SENDS ? prev : []));
fs.writeFileSync('docs/pool-limits-testnet.json', JSON.stringify({ wallet: id, pool: POOL, limits: { near_per_send: '0.1 NEAR', near_per_day: '0.2 NEAR' }, spent, recipient: fresh, txs: out, at: new Date().toISOString() }, null, 1));
const bad = out.filter((t) => (t.label.startsWith('attack') ? t.ok : !t.ok));
console.log(bad.length ? `FAIL ${bad.length}` : `PASS all ${out.length}`);
process.exit(bad.length ? 1 : 0);
