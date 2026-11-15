// SPDX-License-Identifier: MIT
// Pocket policy engine: the pure, side effect free rules the server applies before it pays gas or
// counts money against a limit. Kept free of I/O so every rule is unit and property tested
// (tests/unit/policy.test.ts). The formal statement of each rule is in docs/POLICY.md.
import { PUSD, ROOT, TOKENS, USDC, VERIFIER } from './deployment';
import { DEVICE_ALLOWANCE, DEVICE_METHODS, OWNER_METHODS, TRADE_GAS } from './wallet';

export class PolicyError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const deny = (status: number, msg: string): never => { throw new PolicyError(status, msg); };

const TGAS = 10n ** 12n;
const YOCTO = 10n ** 24n;
export const MAX_GAS_PER_ACTION = 50n * TGAS;
export const MAX_NEAR_PER_DELEGATE = 5n * YOCTO;
export const ONE_YOCTO = '1';
export const USDC_STORAGE = (125n * 10n ** 19n).toString(); // 0.00125 NEAR
const USDC_DECIMALS = 6;
const SERVICE = ['admin', 'verifier', 'maker', 'faucet', 'relayer', 'market'];

// NEAR account id grammar (nomicon), 2 to 64 chars.
export const validAccountId = (a: unknown): a is string =>
  typeof a === 'string' && a.length >= 2 && a.length <= 64 && /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/.test(a);

// A Pocket user is exactly one label under ROOT that is not a service or token account.
export const isPocketUser = (a: unknown): a is string => {
  if (typeof a !== 'string' || !a.endsWith('.' + ROOT)) return false;
  const label = a.slice(0, -ROOT.length - 1);
  if (!/^[a-z0-9_-]{2,32}$/.test(label)) return false;
  return ![...SERVICE, ...TOKENS.map((t) => t.contract.split('.')[0])].includes(label);
};

const uint = (v: unknown): v is string => typeof v === 'string' && /^\d{1,40}$/.test(v);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const ED25519 = /^ed25519:[1-9A-HJ-NP-Za-km-z]{43,44}$/;

export type DelegateAction = { type: 'functionCall'; method: string; args: Record<string, unknown>; gas: string; deposit: string } | { type: 'transfer'; deposit: string } | { type: 'addKey'; publicKey: string; methods: string[]; allowance: string };
export type DelegateJson = { senderId: string; receiverId: string; nonce: string; maxBlockHeight: string; publicKey: string; actions: DelegateAction[]; signature: string };

/**
 * Relayer policy for NEP-366 delegate actions. Returns the dollar amount the delegate moves
 * (USDC), which the caller counts against the daily limit. Throws PolicyError for anything the
 * relayer must not pay for. Allow list (and nothing else):
 *   R1  sender is a Pocket user (never a service account)
 *   R2  one or two actions, every field well formed (strings of digits, valid account ids)
 *   R3  NEAR transfers: total across the delegate at most 5 NEAR
 *   R4  verifier.add_public_key: alone, 1 yocto, an ed25519 key
 *   R5  usdc.storage_deposit: exactly 0.00125 NEAR, registration_only
 *   R6  usdc.ft_transfer: 1 yocto, valid receiver, amount above zero
 *   R7  every function call at most 50 Tgas
 */
export function delegatePolicy(d: unknown): number {
  if (!isObj(d)) return deny(400, 'Send a delegate action.');
  if (!isPocketUser(d.senderId)) return deny(403, 'Only Pocket accounts can use the Pocket relayer.');
  if (!validAccountId(d.receiverId)) return deny(400, 'Bad receiver.');
  if (!uint(d.nonce) || !uint(d.maxBlockHeight)) return deny(400, 'Bad nonce or block height.');
  if (typeof d.publicKey !== 'string' || !ED25519.test(d.publicKey)) return deny(400, 'Bad public key.');
  const actions = d.actions;
  if (!Array.isArray(actions) || actions.length < 1 || actions.length > 2) return deny(400, 'One or two actions only.');
  if (d.receiverId === d.senderId) return walletPolicy(d as unknown as DelegateJson).usd;
  let usd = 0;
  let near = 0n;
  for (const a of actions as unknown[]) {
    if (!isObj(a)) return deny(400, 'Bad action.');
    if (a.type === 'transfer') {
      if (!uint(a.deposit) || BigInt(a.deposit) === 0n) return deny(400, 'Bad NEAR amount.');
      near += BigInt(a.deposit);
      if (near > MAX_NEAR_PER_DELEGATE) return deny(400, 'NEAR sends are capped at 5 NEAR on testnet.');
      continue;
    }
    if (a.type !== 'functionCall' || typeof a.method !== 'string' || !isObj(a.args) || !uint(a.gas) || !uint(a.deposit)) return deny(400, 'Bad action.');
    if (BigInt(a.gas) > MAX_GAS_PER_ACTION) return deny(400, 'Too much gas.');
    const args = a.args;
    if (d.receiverId === VERIFIER && a.method === 'add_public_key' && a.deposit === ONE_YOCTO && actions.length === 1 && typeof args.public_key === 'string' && ED25519.test(args.public_key)) continue;
    if (d.receiverId === USDC && a.method === 'storage_deposit' && a.deposit === USDC_STORAGE && args.registration_only === true && validAccountId(args.account_id)) continue;
    if (d.receiverId === USDC && a.method === 'ft_transfer' && a.deposit === ONE_YOCTO && validAccountId(args.receiver_id) && uint(args.amount) && BigInt(args.amount) > 0n) {
      usd += Number(BigInt(args.amount)) / 10 ** USDC_DECIMALS;
      continue;
    }
    return deny(403, `The relayer does not pay for ${d.receiverId}.${a.method}.`);
  }
  return usd;
}

const WALLET_METHODS: readonly string[] = [...DEVICE_METHODS, ...OWNER_METHODS];
/**
 * Relayer policy for calls to the user's own Pocket wallet contract (on chain limits). The chain
 * enforces the rules; this is the second layer, so the relayer only pays for well formed calls:
 *   R8  one function call on the sender's own account, deposit 0 (function call keys cannot
 *       attach NEAR anyway), a wallet method, at most 280 Tgas, arguments well formed
 *   R9  restore: one AddKey of a function call key scoped to the sender's own account with
 *       exactly the device methods and the standard 0.25 NEAR gas allowance (needs a full key)
 * Returns the dollar amount moved (pUSD or USDC sends), counted again against the server limit.
 */
export function walletPolicy(d: DelegateJson): { usd: number; method: string } {
  const actions = d.actions;
  if (!Array.isArray(actions) || actions.length !== 1) return deny(400, 'One action only.');
  const a = actions[0] as unknown;
  if (!isObj(a)) return deny(400, 'Bad action.');
  if (a.type === 'addKey') {
    const m = a.methods;
    if (typeof a.publicKey !== 'string' || !ED25519.test(a.publicKey) || a.publicKey === d.publicKey) return deny(400, 'Bad device key.');
    if (!Array.isArray(m) || m.length !== DEVICE_METHODS.length || !DEVICE_METHODS.every((x, i) => m[i] === x)) return deny(403, 'A new device key gets exactly the device methods.');
    if (a.allowance !== DEVICE_ALLOWANCE) return deny(400, 'Bad gas allowance.');
    return { usd: 0, method: 'add_device_key' };
  }
  if (a.type !== 'functionCall' || typeof a.method !== 'string' || !isObj(a.args) || !uint(a.gas) || a.deposit !== '0') return deny(400, 'Wallet calls carry no deposit.');
  if (!WALLET_METHODS.includes(a.method)) return deny(403, `The relayer does not pay for ${a.method}.`);
  if (BigInt(a.gas) > TRADE_GAS) return deny(400, 'Too much gas.');
  const args = a.args;
  const amt = (v: unknown) => (uint(v) && BigInt(v) > 0n ? BigInt(v) : deny(400, 'Bad amount.'));
  const memo = (v: unknown) => (v == null || (typeof v === 'string' && v.length <= 256) ? true : deny(400, 'Memo too long.'));
  switch (a.method) {
    case 'send_near':
      if (!validAccountId(args.receiver_id) || args.receiver_id === d.senderId) return deny(400, 'Bad receiver.');
      amt(args.amount);
      return { usd: 0, method: a.method };
    case 'send_usdc':
      if (!validAccountId(args.receiver_id) || args.receiver_id === d.senderId) return deny(400, 'Bad receiver.');
      memo(args.memo);
      return { usd: Number(amt(args.amount)) / 10 ** USDC_DECIMALS, method: a.method };
    case 'send_token': {
      if (!validAccountId(args.receiver_id) || args.receiver_id === d.senderId) return deny(400, 'Bad receiver.');
      const tok = TOKENS.find((t) => t.assetId === args.token_id);
      if (!tok) return deny(400, 'Unknown token.');
      memo(args.memo);
      const v = amt(args.amount);
      return { usd: tok.assetId === PUSD.assetId ? Number(v) / 10 ** tok.decimals : 0, method: a.method };
    }
    case 'trade':
      if (!TOKENS.some((t) => t.assetId === args.pay_token) || typeof args.msg !== 'string' || args.msg.length > 4096) return deny(400, 'Bad trade.');
      amt(args.pay_amount);
      return { usd: 0, method: a.method };
    default:
      return { usd: 0, method: a.method };
  }
}

// A counter that can go up and down atomically (Postgres upsert or the in memory map).
export type Counter = { incr(key: string, ttlSec: number, by?: number): Promise<number> };

/**
 * L1, the daily limit, without a check then act race: add first with one atomic increment, and if
 * the new total is over the limit, take it back and refuse. Concurrent requests can never push
 * the day's total over the limit. Returns a refund function for when the chain rejects the send.
 */
export async function reserveSpend(c: Counter, key: string, limitUsd: number, usd: number, ttlSec = 86400) {
  if (!(usd > 0) || !Number.isFinite(usd)) return deny(400, 'Bad amount.');
  const total = await c.incr(key, ttlSec, usd);
  if (total > limitUsd + 1e-9) {
    await c.incr(key, ttlSec, -usd);
    const left = Math.max(0, limitUsd - (total - usd));
    return deny(403, `Over your daily send limit of $${limitUsd}. You have $${left.toFixed(2)} left today.`);
  }
  let refunded = false;
  return async () => { if (!refunded) { refunded = true; await c.incr(key, ttlSec, -usd); } };
}

/** N1: a signed Pocket message (recipient "pocket") is accepted once. Its nonce is burned. */
export async function burnNonce(c: Counter, scope: string, nonce: string, ttlSec = 600) {
  if (typeof nonce !== 'string' || nonce.length < 16 || nonce.length > 100) return deny(400, 'Bad nonce.');
  if ((await c.incr(`nonce:${scope}:${nonce}`, ttlSec)) > 1) return deny(400, 'This signed message was already used.');
}
