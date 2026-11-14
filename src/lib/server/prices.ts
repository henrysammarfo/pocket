import 'server-only';
// Live prices. Sources, all public and keyless by default:
//   CoinGecko simple/price and market_chart: Ondo tokenized stock tokens, NEAR, USDC (COINGECKO_API_KEY optional).
//   Nasdaq.com public quote JSON: share price, market status, key stats, history (unofficial, no key).
//   Yahoo Finance chart JSON: fallback for shares and 1W bars (unofficial, no key).
// No fixed fallback prices anywhere. If a source fails, callers see the error or the age.
import { cached } from './cache';
import { STOCKS } from '../shared/deployment';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const CG_KEY = process.env.COINGECKO_API_KEY;
const CG_BASE = process.env.COINGECKO_PRO === '1' ? 'https://pro-api.coingecko.com/api/v3' : 'https://api.coingecko.com/api/v3';
const cgHeaders: Record<string, string> = CG_KEY ? (process.env.COINGECKO_PRO === '1' ? { 'x-cg-pro-api-key': CG_KEY } : { 'x-cg-demo-api-key': CG_KEY }) : {};
export const CG_IDS: Record<string, string> = { ...Object.fromEntries(STOCKS.map((s) => [s.token, s.cg])), NEAR: 'near', USDC: 'usd-coin' };
const NQ = { Origin: 'https://www.nasdaq.com', Referer: 'https://www.nasdaq.com/' };

async function j(url: string, h: Record<string, string> = {}) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...h }, signal: AbortSignal.timeout(10000), cache: 'no-store' });
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return r.json();
}
const num = (s: unknown) => (s == null || s === '' ? null : Number(String(s).replace(/[$,%]/g, '')));

export type TokenPrice = { price: number; change24h: number; updatedAt: number; spark?: number[] };
export async function tokenPrices() {
  const { v, t } = await cached('cg', 30000, async () => {
    const d = await j(`${CG_BASE}/simple/price?ids=${Object.values(CG_IDS).join(',')}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`, cgHeaders);
    const out: Record<string, TokenPrice> = {};
    for (const [sym, id] of Object.entries(CG_IDS)) {
      const x = d[id];
      if (x?.usd) out[sym] = { price: x.usd, change24h: x.usd_24h_change ?? 0, updatedAt: (x.last_updated_at ?? 0) * 1000 };
    }
    return out;
  });
  return { tokens: v, fetchedAt: t, source: 'CoinGecko' };
}

async function cgSpark(id: string) {
  const { v } = await cached('cgs:' + id, 600000, async () => {
    const d = await j(`${CG_BASE}/coins/${id}/market_chart?vs_currency=usd&days=1`, cgHeaders);
    return (d.prices as [number, number][]).map((p) => +p[1].toPrecision(6));
  });
  return v;
}

export type SharePrice = { price: number | null; change: number | null; changePct: number | null; lastTrade: string; marketStatus: string | null; source: string; spark: number[]; prevClose: number | null; fetchedAt: number };
async function nasdaq(sym: string, asset: string) {
  const d = (await j(`https://api.nasdaq.com/api/quote/${sym}/info?assetclass=${asset}`, NQ)).data;
  const p = d.primaryData;
  return { price: num(p.lastSalePrice), change: num(p.netChange), changePct: num(p.percentageChange), lastTrade: p.lastTradeTimestamp as string, marketStatus: d.marketStatus as string, source: 'Nasdaq.com' };
}
async function nasdaqSpark(sym: string, asset: string) {
  const d = (await j(`https://api.nasdaq.com/api/quote/${sym}/chart?assetclass=${asset}`, NQ)).data;
  const pts: number[] = (d.chart || []).map((c: { y: number }) => c.y);
  const step = Math.max(1, Math.floor(pts.length / 96));
  return { pts: pts.filter((_, i) => i % step === 0).concat(pts.length ? [pts[pts.length - 1]] : []), prev: num(d.previousClose) };
}
async function yahoo(sym: string) {
  const d = await j(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=1d&interval=5m`);
  const r = d.chart.result[0], m = r.meta;
  return {
    price: m.regularMarketPrice, change: m.regularMarketPrice - m.chartPreviousClose, changePct: (m.regularMarketPrice / m.chartPreviousClose - 1) * 100,
    lastTrade: new Date(m.regularMarketTime * 1000).toISOString(), marketStatus: null, source: 'Yahoo Finance (fallback)',
    spark: ((r.indicators.quote[0].close || []) as (number | null)[]).filter((x): x is number => x != null),
  };
}

export async function sharePrices(): Promise<Record<string, SharePrice | null>> {
  const rows = await Promise.all(STOCKS.map(async (s) => {
    let q: { price: number | null; change: number | null; changePct: number | null; lastTrade: string; marketStatus: string | null; source: string; spark?: number[] } | null = null;
    let t = 0;
    try { const r = await cached('nq:' + s.ticker, 10000, () => nasdaq(s.ticker, s.asset)); q = r.v; t = r.t; }
    catch { try { const r = await cached('yh:' + s.ticker, 15000, () => yahoo(s.ticker)); q = r.v; t = r.t; } catch { q = null; } }
    let sp: { pts: number[]; prev: number | null } | null = null;
    try { sp = (await cached('nqs:' + s.ticker, 60000, () => nasdaqSpark(s.ticker, s.asset))).v; } catch { sp = null; }
    return [s.ticker, q && { ...q, spark: sp?.pts || q.spark || [], prevClose: sp?.prev ?? null, fetchedAt: t }] as const;
  }));
  return Object.fromEntries(rows) as Record<string, SharePrice | null>;
}

export async function quotes() {
  const t0 = Date.now();
  const [cg, stocks] = await Promise.all([tokenPrices().catch((e) => ({ error: String(e), tokens: {} as Record<string, TokenPrice>, fetchedAt: 0, source: 'CoinGecko' })), sharePrices()]);
  await Promise.all(Object.entries(CG_IDS).map(async ([s, id]) => {
    if (cg.tokens[s]) cg.tokens[s] = { ...cg.tokens[s], spark: await cgSpark(id).catch(() => []) };
  }));
  return { serverTime: Date.now(), tookMs: Date.now() - t0, tokens: cg.tokens, tokensFetchedAt: cg.fetchedAt, stocks, error: 'error' in cg ? cg.error : undefined };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
export async function stockDetail(ticker: string) {
  const s = STOCKS.find((x) => x.ticker === ticker.toUpperCase());
  if (!s) throw new Error('Unknown stock');
  const sum = (await cached('nqsum:' + s.ticker, 300000, () => j(`https://api.nasdaq.com/api/quote/${s.ticker}/summary?assetclass=${s.asset}`, NQ)).catch(() => ({ v: { data: null } }))).v?.data?.summaryData || {};
  const hist = async (days: number, lim: number) => {
    const to = new Date(), fr = new Date(Date.now() - days * 864e5);
    const { v } = await cached(`nqh:${s.ticker}:${days}`, 600000, () => j(`https://api.nasdaq.com/api/quote/${s.ticker}/historical?assetclass=${s.asset}&fromdate=${iso(fr)}&todate=${iso(to)}&limit=${lim}`, NQ));
    return ((v.data?.tradesTable?.rows || []) as { date: string; close: string }[]).map((r) => [new Date(r.date).getTime(), num(r.close) as number] as const).reverse();
  };
  const day = await cached('nqs:' + s.ticker, 60000, () => nasdaqSpark(s.ticker, s.asset)).then((r) => r.v).catch(() => ({ pts: [] as number[], prev: null }));
  const week = async () => {
    const { v } = await cached('yh5d:' + s.ticker, 300000, () => j(`https://query1.finance.yahoo.com/v8/finance/chart/${s.ticker}?range=5d&interval=30m`));
    return ((v.chart.result[0].indicators.quote[0].close || []) as (number | null)[]).filter((x): x is number => x != null).map((x) => +x.toFixed(2));
  };
  const thin = <T,>(a: T[]) => { const st = Math.max(1, Math.floor(a.length / 160)); return a.filter((_, i) => i % st === 0 || i === a.length - 1); };
  const [w, m, y, all] = await Promise.all([
    week().catch(() => hist(8, 10).then((h) => h.map((x) => x[1])).catch(() => [])),
    hist(31, 30).catch(() => []), hist(366, 260).catch(() => []), hist(365 * 16, 5000).catch(() => []),
  ]);
  const stats = Object.fromEntries(Object.entries(sum as Record<string, { value: string }>).map(([k, v]) => [k, v?.value]));
  return {
    ticker: s.ticker, stats,
    ranges: { '1D': day.pts, '1W': w, '1M': m.map((x) => x[1]), '1Y': thin(y).map((x) => x[1]), All: thin(all).map((x) => x[1]) },
    prevClose: day.prev, firstDate: { All: all[0]?.[0] ?? null, '1Y': y[0]?.[0] ?? null },
    source: 'Nasdaq.com (1D intraday, key stats, daily closes). 1W from Yahoo Finance 30 min bars', fetchedAt: Date.now(),
  };
}

export async function coinDetail(id: 'near' | 'usd-coin') {
  const r: Record<string, number[]> = {};
  for (const [k, d] of [['1D', 1], ['1W', 7], ['1M', 30], ['1Y', 365]] as const) {
    try {
      const { v } = await cached(`cgc:${id}:${d}`, 1800000, () => j(`${CG_BASE}/coins/${id}/market_chart?vs_currency=usd&days=${d}`, cgHeaders));
      const p = (v.prices as [number, number][]).map((x) => +x[1].toPrecision(6));
      const st = Math.max(1, Math.floor(p.length / 160));
      r[k] = p.filter((_, i) => i % st === 0 || i === p.length - 1);
    } catch { r[k] = []; }
  }
  r.All = r['1Y'];
  const note = 'Free CoinGecko data goes back 365 days';
  return { id, ranges: r, note, source: 'CoinGecko market_chart', fetchedAt: Date.now() };
}

// FX for local currency estimates. ExchangeRate-API open access, attribution required.
export async function fx() {
  const { v, t } = await cached('fx', 3600000, () => j('https://open.er-api.com/v6/latest/USD'));
  return { rates: v.rates as Record<string, number>, updated: v.time_last_update_utc as string, fetchedAt: t, source: 'ExchangeRate-API (open.er-api.com)' };
}
