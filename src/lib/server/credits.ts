import 'server-only';
// AI credits. Every user gets a free monthly allowance. Each AI action costs credits, metered on the
// server per account and per month, so one person cannot run up the AI bill for everyone.
// 1 credit is about $0.0001 of AI cost at NEAR AI Cloud prices (see docs/BUSINESS.md).
import { store, HttpError } from './store';

export const FREE_CREDITS = Number(process.env.FREE_CREDITS_PER_MONTH || 1000);
export const COST = { chat: 2, voice: 3, photo: 4, memory: 0 } as const;
const month = () => new Date().toISOString().slice(0, 7);
const key = (a: string) => `credits:${a}:${month()}`;
const ttl = () => { const d = new Date(); const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); return Math.ceil((next - Date.now()) / 1000) + 60; };

export async function creditsOf(account: string) {
  const used = await store.get(key(account));
  const d = new Date(); const resets = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString();
  return { used, total: FREE_CREDITS, left: Math.max(0, FREE_CREDITS - used), resets, plan: 'free' as const };
}
export async function spend(account: string, n: number) {
  const c = await creditsOf(account);
  if (c.left < n) throw new HttpError(402, `You have used this month's ${FREE_CREDITS} free AI credits. They reset on ${c.resets.slice(0, 10)}. Money commands still work without AI.`);
  await store.incr(key(account), ttl(), n);
}
// Charge real usage when the provider reports tokens: ceil(dollars / $0.0001), at least the base cost.
export async function settleUsage(account: string, base: number, usd: number) {
  const extra = Math.max(0, Math.ceil(usd / 0.0001) - base);
  if (extra > 0) await store.incr(key(account), ttl(), Math.min(extra, 50));
}
export async function refund(account: string, n: number) { await store.incr(key(account), ttl(), -n); }
