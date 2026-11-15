// SPDX-License-Identifier: MIT
// Pocket wallet: the account's own contract (contracts/wallet) enforces the spending rules on chain.
// This file holds the method names, the default rules and the helpers the app and server share.
import { ed25519 } from '@noble/curves/ed25519.js';
import { PUSD, STOCK_TOKENS } from './deployment';
import blocklist from '../../../data/blocklist.json';

/** Shared block list with reasons and evidence (data/blocklist.json). New wallets start with it on chain. */
export const BLOCKLIST: { account: string; reason: string; evidence: string }[] = blocklist.entries;

/** Methods the phone's function call access key may call on its own account. Nothing else. */
export const DEVICE_METHODS = ['send_near', 'send_usdc', 'send_token', 'trade', 'lower_limits', 'cancel_pending', 'owner_action'] as const;
/** Methods only a direct call from an owner access key may use (accounts made before wallet v2). */
export const OWNER_METHODS = ['propose_limits', 'set_owner_keys'] as const;

// ---------- wallet v2: owner messages and signed prices ----------
/** Owner messages and prices are signed over these prefixes (raw ed25519, hex signature). */
export const OWNER_TAG = 'pocket.wallet.owner.v1\n';
export const PRICE_TAG = 'pocket.price.v1\n';
export type OwnerAction = { set_limits: { limits: Limits } } | { add_device_key: { public_key: string } } | { remove_key: { public_key: string } } | { set_owner_keys: { owner_keys: string[] } } | 'cancel_pending';
export const ownerPayload = (account: string, nonce: number, action: OwnerAction) => JSON.stringify({ account, nonce, action });
const utf8 = (s: string) => new TextEncoder().encode(s);
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (h: string) => { if (!/^([0-9a-f]{2})*$/i.test(h)) throw new Error('bad hex'); return Uint8Array.from(h.match(/../g) || [], (x) => parseInt(x, 16)); };
export const signTagged = (tag: string, msg: string, seed: Uint8Array) => hex(ed25519.sign(utf8(tag + msg), seed));
export function verifyTagged(tag: string, msg: string, sigHex: string, pubBytes: Uint8Array) {
  try { return ed25519.verify(unhex(sigHex), utf8(tag + msg), pubBytes); } catch { return false; }
}
export type SignedPrice = { payload: string; signature: string };
export type PricePayload = { v: 1; token: string; micro_usd: string; decimals: number; expires_ms: number };
/** Micro dollars for `units` of a token at a signed price, the same integer math as the contract. */
export const microUsdOf = (units: bigint, p: PricePayload) => (units * BigInt(p.micro_usd)) / 10n ** BigInt(p.decimals);
/** Gas allowance on the device key, in yocto NEAR: what the key may burn if it ever pays its own gas. */
export const DEVICE_ALLOWANCE = (25n * 10n ** 22n).toString(); // 0.25 NEAR
export const SEND_GAS = 60n * 10n ** 12n;
export const TRADE_GAS = 280n * 10n ** 12n;
export const RULE_GAS = 50n * 10n ** 12n;

export type TokenCap = { token_id: string; per_send: string; per_day: string };
export type Limits = {
  usd_per_send: string; usd_per_day: string; near_per_send: string; near_per_day: string;
  token_caps: TokenCap[]; max_trade_usd: string;
  allow_near: boolean; allow_usdc: boolean; allow_tokens: boolean; allow_trade: boolean;
  allow_only: string[] | null; blocked: string[]; raise_delay_sec: number;
};

const USD = 10n ** 6n;
const NEAR = 10n ** 24n;
const SHARE = 10n ** 18n;
export const DEFAULT_DAILY_USD = 200;
export const RAISE_DELAY_SEC = Number(process.env.NEXT_PUBLIC_RAISE_DELAY_SEC || 86400);

/** The rules every new Pocket account starts with. */
export function defaultLimits(dailyUsd = DEFAULT_DAILY_USD, raiseDelaySec = RAISE_DELAY_SEC): Limits {
  const day = BigInt(Math.round(dailyUsd * 1e6));
  return {
    usd_per_send: (day < 100n * USD ? day : 100n * USD).toString(),
    usd_per_day: day.toString(),
    near_per_send: NEAR.toString(),
    near_per_day: (2n * NEAR).toString(),
    token_caps: STOCK_TOKENS.map((t) => ({ token_id: t.assetId, per_send: (5n * SHARE).toString(), per_day: (20n * SHARE).toString() })),
    max_trade_usd: (1000n * USD).toString(),
    allow_near: true, allow_usdc: true, allow_tokens: true, allow_trade: true,
    allow_only: null, blocked: BLOCKLIST.map((b) => b.account), raise_delay_sec: raiseDelaySec,
  };
}

/** New rules with a different daily dollar cap; the per send cap never exceeds the daily cap. */
export function withDaily(cur: Limits, dailyUsd: number): Limits {
  const day = BigInt(Math.round(dailyUsd * 1e6));
  const perSend = BigInt(cur.usd_per_send);
  const wantSend = day < 100n * USD ? day : (perSend > day ? day : (perSend < 100n * USD ? 100n * USD : perSend));
  return { ...cur, usd_per_day: day.toString(), usd_per_send: wantSend.toString() };
}

/** Same rule as the contract's is_raise: true when `n` loosens anything compared with `o`. */
export function isRaise(n: Limits, o: Limits): boolean {
  const gt = (a: string, b: string) => BigInt(a) > BigInt(b);
  if (gt(n.usd_per_send, o.usd_per_send) || gt(n.usd_per_day, o.usd_per_day) || gt(n.near_per_send, o.near_per_send) || gt(n.near_per_day, o.near_per_day) || gt(n.max_trade_usd, o.max_trade_usd) || n.raise_delay_sec < o.raise_delay_sec) return true;
  if ((n.allow_near && !o.allow_near) || (n.allow_usdc && !o.allow_usdc) || (n.allow_tokens && !o.allow_tokens) || (n.allow_trade && !o.allow_trade)) return true;
  if (n.token_caps.some((c) => { const x = o.token_caps.find((y) => y.token_id === c.token_id); return !x || gt(c.per_send, x.per_send) || gt(c.per_day, x.per_day); })) return true;
  if (o.allow_only && (!n.allow_only || n.allow_only.some((a) => !o.allow_only!.includes(a)))) return true;
  return o.blocked.some((b) => !n.blocked.includes(b));
}

export const dollarsOf = (units: string) => Number(BigInt(units)) / 1e6;
export const DOLLAR_TOKENS = [PUSD.assetId];
