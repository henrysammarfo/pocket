import 'server-only';
// Build, sign and send NEAR testnet transactions from server accounts (relayer, sponsor, maker, faucet).
import { actionCreators, createTransaction, encodeTransaction, Signature, SignedTransaction, type Action } from '@near-js/transactions';
import { PublicKey } from '@near-js/crypto';
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import bs58 from 'bs58';
import { rpc, viewAccessKey } from '../shared/rpc';
import { keyFromString, b64encode } from '../shared/nep413';

export const TGAS = 10n ** 12n;
export { actionCreators };

export type TxResult = { ok: boolean; hash: string; failures: string[]; logs: string[]; returnValue?: string; raw: any };

const locks = new Map<string, Promise<unknown>>();
const nonces = new Map<string, bigint>();

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) || Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => (release = r));
  locks.set(key, prev.then(() => next));
  await prev.catch(() => {});
  try { return await fn(); } finally { release(); }
}

export function summarize(raw: any, hash: string): TxResult {
  const failures: string[] = [];
  const logs: string[] = [];
  const outcomes = [raw?.transaction_outcome, ...(raw?.receipts_outcome || [])].filter(Boolean);
  for (const o of outcomes) {
    logs.push(...(o.outcome?.logs || []));
    const f = o.outcome?.status?.Failure;
    if (f) failures.push(JSON.stringify(f));
  }
  const top = raw?.status?.Failure;
  if (top && !failures.length) failures.push(JSON.stringify(top));
  const sv = raw?.status?.SuccessValue;
  return { ok: !top && failures.length === 0, hash, failures, logs, returnValue: sv, raw };
}

export async function signAndSend(signerId: string, secret: string, receiverId: string, actions: Action[]): Promise<TxResult> {
  const k = keyFromString(secret);
  return withLock(signerId + k.publicKey, async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      let nonce = nonces.get(k.publicKey);
      if (nonce == null || attempt > 0) {
        const ak = await viewAccessKey(signerId, k.publicKey);
        if (!ak) throw new Error(`No access key for ${signerId}`);
        nonce = BigInt(ak.nonce);
      }
      nonce += 1n;
      const block = await rpc<{ header: { hash: string } }>('block', { finality: 'final' });
      const tx = createTransaction(signerId, PublicKey.fromString(k.publicKey), receiverId, nonce, actions, bs58.decode(block.header.hash));
      const bytes = encodeTransaction(tx);
      const digest = sha256(bytes);
      const sig = ed25519.sign(digest, k.seed);
      const signed = new SignedTransaction({ transaction: tx, signature: new Signature({ keyType: 0, data: sig }) });
      const hash = bs58.encode(digest);
      try {
        const raw = await rpc('send_tx', { signed_tx_base64: b64encode(signed.encode()), wait_until: 'EXECUTED_OPTIMISTIC' });
        nonces.set(k.publicKey, nonce);
        return summarize(raw, hash);
      } catch (e) {
        const msg = String((e as Error).message) + JSON.stringify((e as { data?: unknown }).data || '');
        if (/InvalidNonce|nonce/i.test(msg) && attempt < 2) { nonces.delete(k.publicKey); continue; }
        if (/TIMEOUT|timeout/i.test(msg)) {
          // The tx may still land. Report the hash so the client can poll it.
          return { ok: false, hash, failures: ['Timed out waiting for the network. Check the transaction.'], logs: [], raw: null };
        }
        throw e;
      }
    }
    throw new Error('Could not get a fresh nonce');
  });
}

export const fnCall = (method: string, args: object, gasT = 100n, deposit = 0n) =>
  actionCreators.functionCall(method, Buffer.from(JSON.stringify(args)), gasT * TGAS, deposit);

export async function txStatus(hash: string, sender: string) {
  const raw = await rpc('tx', { tx_hash: hash, sender_account_id: sender, wait_until: 'EXECUTED_OPTIMISTIC' });
  return summarize(raw, hash);
}
