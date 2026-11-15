// SPDX-License-Identifier: MIT
// Pocket wallet: the account's own contract (contracts/wallet) enforces the spending rules on chain.
// This file holds the method names, the default rules and the helpers the app and server share.
import { PUSD, STOCK_TOKENS } from './deployment';

/** Methods the phone's function call access key may call on its own account. Nothing else. */
export const DEVICE_METHODS = ['send_near', 'send_usdc', 'send_token', 'trade', 'lower_limits', 'cancel_pending'] as const;
/** Methods only an owner key (the recovery key, full access) may call. */
export const OWNER_METHODS = ['propose_limits', 'set_owner_keys'] as const;
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
    allow_only: null, blocked: [], raise_delay_sec: raiseDelaySec,
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
