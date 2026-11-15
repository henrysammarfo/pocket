// Testnet proof run for the private pool. Testnet only. Keys are read from the local NEAR keychain and
// never printed. Notes (secrets) are written to POCKET_SECRETS_DIR with mode 600.
//   1. DEPOSITOR deposits two 0.1 NEAR notes into pool.<ROOT>.
//   2. The relayer withdraws note 1 to a brand new implicit account, with a Groth16 proof.
//   3. Attacks on chain: the same note again (double spend), the proof with another recipient,
//      a forged proof, an unknown root. Each must fail; the failed transactions are recorded too.
// Writes docs/pool-testnet.json with every transaction hash.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { connect, keyStores, utils } from 'near-api-js';
import { makeNote, proveWithdraw, type Note } from '../src/lib/shared/zkpool';

const dep = JSON.parse(fs.readFileSync('deployment/testnet.json', 'utf8'));
const POOL: string = dep.pool;
const DEPOSITOR = process.env.DEPOSITOR || 'admin.' + dep.root;
const RELAYER = process.env.RELAYER_ACCOUNT || dep.relayer;
const SECRETS = path.resolve(process.env.POCKET_SECRETS_DIR || '.secrets');
const keyStore = new keyStores.UnencryptedFileSystemKeyStore(path.join(os.homedir(), '.near-credentials'));
const near = await connect({ networkId: 'testnet', nodeUrl: process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com', keyStore });
const TGAS = 10n ** 12n;
const out: { label: string; hash: string; ok: boolean; error?: string }[] = [];
const RPC = process.env.NEAR_RPC_URL || 'https://test.rpc.fastnear.com';
async function view(m: string, a: object = {}) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'query', params: { request_type: 'call_function', finality: 'optimistic', account_id: POOL, method_name: m, args_base64: Buffer.from(JSON.stringify(a)).toString('base64') } }) }).then((x) => x.json());
  if (r.error || r.result?.error) throw new Error(JSON.stringify(r.error || r.result.error));
  return JSON.parse(Buffer.from(r.result.result).toString());
}

async function call(signer: string, method: string, args: object, deposit = 0n, label = method, expectFail = false) {
  const acct = await near.account(signer);
  try {
    const r = await acct.functionCall({ contractId: POOL, methodName: method, args, attachedDeposit: deposit, gas: 300n * TGAS });
    const failed = JSON.stringify(r.receipts_outcome).includes('Failure');
    out.push({ label, hash: r.transaction.hash, ok: !failed });
    console.log(failed ? '  FAILED' : '  ok', label, r.transaction.hash);
    return r;
  } catch (e) {
    const err = e as { transaction_outcome?: { id: string }; context?: { transactionHash?: string }; message: string };
    const hash = err.transaction_outcome?.id || err.context?.transactionHash || '';
    out.push({ label, hash, ok: false, error: err.message.slice(0, 160) });
    console.log(expectFail ? '  refused as expected' : '  ERROR', label, hash, err.message.slice(0, 120));
    if (!expectFail) throw e;
    return null;
  }
}

const denom = BigInt((await view('get_info')).denomination);
const notes: Note[] = [];
for (let i = 0; i < 2; i++) {
  const n = await makeNote(POOL, denom.toString());
  const r = await call(DEPOSITOR, 'deposit', { commitment: n.commitment }, denom, `deposit note ${i + 1} from ${DEPOSITOR}`);
  if (r) notes.push(n);
}
fs.writeFileSync(path.join(SECRETS, `pool-notes-${Date.now()}.json`), JSON.stringify(notes), { mode: 0o600 });

const leaves = (await view('get_leaves', { from: 0, limit: 500 })).map((x: string) => BigInt(x));
const fresh = crypto.randomBytes(32).toString('hex'); // a brand new implicit account, created by the payout
const w = await proveWithdraw(notes[0], leaves, fresh, null, 0n, 'public/zk/withdraw.wasm', 'public/zk/withdraw.zkey');
await call(RELAYER, 'withdraw', { ...w, fee: '0' }, 0n, `relayer withdraws one note to a new account ${fresh.slice(0, 8)}…`);
const spent = await view('is_spent', { nullifier_hash: notes[0].nullifierHash });
console.log('  note 1 spent:', spent);

// attacks
await call(RELAYER, 'withdraw', { ...w, fee: '0' }, 0n, 'attack: same note again (double spend)', true);
const w2 = await proveWithdraw(notes[1], leaves, fresh, null, 0n, 'public/zk/withdraw.wasm', 'public/zk/withdraw.zkey');
await call(RELAYER, 'withdraw', { ...w2, recipient: RELAYER, fee: '0' }, 0n, 'attack: valid proof, recipient swapped to the relayer', true);
const forged = { ...w2, proof: { ...w2.proof, pi_a: w2.proof.pi_c, pi_c: w2.proof.pi_a } };
await call(RELAYER, 'withdraw', { ...forged, fee: '0' }, 0n, 'attack: forged proof', true);
await call(RELAYER, 'withdraw', { ...w2, root: '1', fee: '0' }, 0n, 'attack: unknown root', true);
await call(RELAYER, 'withdraw', { ...w2, relayer: RELAYER, fee: utils.format.parseNearAmount('0.05') }, 0n, 'attack: relayer adds itself a fee the proof did not sign', true);

const info = await view('get_info');
fs.writeFileSync('docs/pool-testnet.json', JSON.stringify({ pool: POOL, info, recipient: fresh, txs: out, at: new Date().toISOString() }, null, 1));
const bad = out.filter((t) => t.label.startsWith('attack') ? t.ok : !t.ok);
console.log(bad.length ? `FAIL ${bad.length}` : `PASS all ${out.length}`);
process.exit(bad.length ? 1 : 0);
