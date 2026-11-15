// SPDX-License-Identifier: MIT
// Request money links. A request is { id, account, amount, token, note }. The payer's send carries the
// memo "pocket request <id>", a refund carries "pocket refund <id>". The status is worked out from the
// requester's activity (which the server writes only after the chain accepted the send), so it needs
// no extra state: pending until a matching payment arrives, paid after it, refunded after the requester
// sends the same amount back to the payer with the refund memo.
import { toUnits } from './units';

export const REQUEST_TOKENS = ['pUSD', 'USDC'] as const;
export type RequestToken = (typeof REQUEST_TOKENS)[number];
export type PayRequest = { id: string; account: string; amount: string; token: RequestToken; note: string; at: number; due?: number | null };
export type RequestStatus = { status: 'pending' | 'paid' | 'refunded'; overdue?: boolean; paidTx?: string; payer?: string; paidAt?: number; paidAmount?: string; refundTx?: string; refundedAt?: number };
type Act = { kind: string; tx: string; data: Record<string, unknown>; at: number };

export const MAX_REQUEST = 10_000;
const ID = /^[a-z0-9]{12}$/;
export const validRequestId = (v: unknown): v is string => typeof v === 'string' && ID.test(v);
export function newRequestId(rand: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(rand(12), (b) => abc[b % 36]).join('');
}
export const requestMemo = (id: string) => `pocket request ${id}`;
export const refundMemo = (id: string) => `pocket refund ${id}`;
export function parseMemo(m: unknown): { kind: 'request' | 'refund'; id: string } | null {
  const x = typeof m === 'string' ? /^pocket (request|refund) ([a-z0-9]{12})$/.exec(m.trim()) : null;
  return x ? { kind: x[1] as 'request' | 'refund', id: x[2] } : null;
}

// Amounts are compared as integers with 8 decimals, enough for both pUSD and USDC.
const decimals = (_t: RequestToken) => 8;
// Validates what a person typed. Returns the clean request fields or a reason in plain English.
export const MAX_DUE_DAYS = 365;
/** A due date typed as YYYY-MM-DD: end of that day in UTC, today or later, at most a year ahead. */
export function cleanDue(v: unknown, now = Date.now()): { ok: true; due: number | null } | { ok: false; reason: string } {
  if (v == null || v === '') return { ok: true, due: null };
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return { ok: false, reason: 'Pick a due date like 2026-11-20.' };
  const t = Date.parse(v + 'T23:59:59Z');
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== v) return { ok: false, reason: 'That due date is not a real day.' };
  if (t < now) return { ok: false, reason: 'The due date has already passed.' };
  if (t > now + MAX_DUE_DAYS * 86_400_000) return { ok: false, reason: 'Pick a due date within a year.' };
  return { ok: true, due: t };
}
export function cleanRequest(input: { amount?: unknown; token?: unknown; note?: unknown; due?: unknown }, now = Date.now()): { ok: true; amount: string; token: RequestToken; note: string; due: number | null } | { ok: false; reason: string } {
  const token = (input.token ?? 'pUSD') as RequestToken;
  if (!REQUEST_TOKENS.includes(token)) return { ok: false, reason: 'Requests can be in pUSD or USDC.' };
  const raw = typeof input.amount === 'number' ? String(input.amount) : typeof input.amount === 'string' ? input.amount.trim() : '';
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(raw)) return { ok: false, reason: 'Enter an amount like 25 or 12.50.' };
  const n = Number(raw);
  if (!(n >= 0.01)) return { ok: false, reason: 'The smallest request is 0.01.' };
  if (n > MAX_REQUEST) return { ok: false, reason: `The largest request is ${MAX_REQUEST.toLocaleString('en-US')}.` };
  const note = typeof input.note === 'string' ? input.note.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  if (note.length > 80) return { ok: false, reason: 'Keep the note under 80 characters.' };
  const d = cleanDue(input.due, now);
  if (!d.ok) return d;
  return { ok: true, amount: String(n), token, note, due: d.due };
}

const units = (v: unknown, t: RequestToken) => { try { return toUnits(String(v), decimals(t)); } catch { return -1n; } };
export function requestStatus(r: PayRequest, activity: Act[], now = Date.now()): RequestStatus {
  const want = units(r.amount, r.token);
  const sorted = [...activity].sort((a, b) => a.at - b.at);
  const paid = sorted.find((a) => a.kind === 'receive' && a.at >= r.at - 60_000 && a.data.memo === requestMemo(r.id) && a.data.token === r.token && units(a.data.amount, r.token) >= want);
  if (!paid) return r.due && now > r.due ? { status: 'pending', overdue: true } : { status: 'pending' };
  const payer = String(paid.data.from || '');
  const got = units(paid.data.amount, r.token);
  const base: RequestStatus = { status: 'paid', paidTx: paid.tx, payer, paidAt: paid.at, paidAmount: String(paid.data.amount) };
  const refund = sorted.find((a) => a.kind === 'send' && a.at >= paid.at && a.data.memo === refundMemo(r.id) && a.data.to === payer && a.data.token === r.token && units(a.data.amount, r.token) >= got);
  return refund ? { ...base, status: 'refunded', refundTx: refund.tx, refundedAt: refund.at } : base;
}
export const requestPath = (username: string, id: string) => `/pay/${encodeURIComponent(username)}?r=${id}`;
