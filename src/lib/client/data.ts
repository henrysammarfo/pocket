'use client';
import { api } from './api';
import { getContacts, useLive, useSession, type Contact } from './session';
import { detect } from '../shared/address';
import { ROOT, STOCKS } from '../shared/deployment';

export type Quotes = {
  serverTime: number; tokensFetchedAt: number; error?: string;
  tokens: Record<string, { price: number; change24h: number; updatedAt: number; spark?: number[] }>;
  stocks: Record<string, { price: number | null; changePct: number | null; change: number | null; lastTrade: string; marketStatus: string | null; source: string; spark: number[]; prevClose: number | null } | null>;
};
export type Balances = { account: string; exists: boolean; near: string; usdc: string; pool: Record<string, string>; limit: number; usedToday: number };

export const useQuotes = () => useLive<Quotes>(() => api('/api/quotes'), [], 10000);
export function useBalances() {
  const s = useSession();
  return useLive<Balances | null>(() => (s ? api(`/api/balances?account=${encodeURIComponent(s.account)}`) : Promise.resolve(null)), [s?.account], 15000);
}
export function summary(b: Balances | null, q: Quotes | null) {
  const pusd = Number(b?.pool.pUSD || 0), usdc = Number(b?.usdc || 0), near = Number(b?.near || 0);
  const holdings: Record<string, number> = {};
  const prices: Record<string, number> = {};
  let stocks = 0, stocksPrev = 0;
  for (const s of STOCKS) {
    const qty = Number(b?.pool[s.token] || 0);
    holdings[s.ticker] = qty;
    const t = q?.tokens[s.token];
    if (t) { prices[s.ticker] = t.price; stocks += qty * t.price; stocksPrev += (qty * t.price) / (1 + (t.change24h || 0) / 100); }
  }
  const nearUsd = near * (q?.tokens.NEAR?.price || 0);
  return { pusd, usdc, near, nearUsd, dollars: pusd + usdc, stocks, stocksDay: stocks - stocksPrev, holdings, prices, total: pusd + usdc + stocks };
}

export type Resolved = { account: string; label: string; kind: 'contact' | 'pocket' | 'near'; contact?: Contact; exists: boolean } | { error: string };
export async function resolveRecipient(input: string): Promise<Resolved> {
  const raw = input.trim().replace(/^my\s+/i, '');
  const c = getContacts().find((x) => x.name.toLowerCase() === raw.toLowerCase());
  if (c) {
    if (c.network !== 'near') return { error: `${c.name} is a ${c.network === 'sol' ? 'Solana' : c.network === 'eth' ? 'Ethereum' : 'Polygon'} address. Cross chain sends are on the roadmap, so Pocket cannot send there yet.` };
    return { account: c.address, label: c.name, kind: 'contact', contact: c, exists: true };
  }
  const d = detect(raw, ROOT);
  if (d.kind === 'username' || d.kind === 'near-named' || d.kind === 'near-implicit') {
    const q = d.kind === 'username' ? d.username : d.account;
    const r = await api<{ account: string; exists: boolean; pocket: boolean }>(`/api/account/lookup?q=${encodeURIComponent(q)}`);
    if (!r.exists && d.kind !== 'near-implicit') return { error: d.kind === 'username' ? `I could not find ${raw} on Pocket or a saved contact with that name. Add them in Contacts, or use their NEAR testnet account.` : `${q} does not exist on NEAR testnet.` };
    return { account: r.account, label: d.kind === 'username' ? '@' + d.username : r.account, kind: r.pocket ? 'pocket' : 'near', exists: r.exists };
  }
  if (d.kind === 'mainnet' || d.kind === 'unsupported') return { error: d.reason };
  if (d.kind === 'solana' || d.kind === 'evm-or-near') return { error: 'That is an outside wallet address. Use Send to pick the network; cross chain routes are on the roadmap.' };
  return { error: 'Who should get it? Use a saved name, @username or a NEAR testnet account.' };
}

export const ago = (ms: number) => { const s = Math.max(0, Math.round((Date.now() - ms) / 1000)); return s < 60 ? `${s} s ago` : s < 3600 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`; };
export const when = (ms: number) => { const d = new Date(ms); const today = new Date().toDateString() === d.toDateString(); return (today ? 'Today ' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ') + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
