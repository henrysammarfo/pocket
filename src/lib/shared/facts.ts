// Plain facts the chat answers itself, from Pocket's own data, so the AI can never refuse a stock
// price or guess today's date. Pure functions, unit tested in tests/unit/chat-facts.test.ts.
import { STOCKS } from './deployment';

const NAMES: [RegExp, string][] = [
  [/\b(tesla|tsla|tslaon)\b/i, 'TSLA'],
  [/\b(nvidia|nvda|nvdaon)\b/i, 'NVDA'],
  [/\b(apple|aapl|aaplon)\b/i, 'AAPL'],
  [/\b(s ?& ?p(\s*500)?|sp500|spy|spyon)\b/i, 'SPY'],
  [/\b(nasdaq(\s*100)?|qqq|qqqon)\b/i, 'QQQ'],
];
const PRICE_WORDS = /\b(price|prices|cost|costs|worth|trading|trade at|going for|quote|value|how much (is|are|does)|what('?s| is) .{0,20}\bat\b)\b/i;
const MONEY_ACTION = /\b(buy|sell|send|invest|put|pay)\b\s+(\$?\d|all|half|some|my)/i;

/** The ticker when the message asks for a stock price (and is not an order). */
export function priceAsk(text: string): string | null {
  const t = String(text || '').slice(0, 300);
  if (!PRICE_WORDS.test(t) || MONEY_ACTION.test(t)) return null;
  const hits = NAMES.filter(([re]) => re.test(t));
  return hits.length === 1 ? hits[0][1] : null;
}

/** True when the message asks for today's date, day or time. */
export const dateAsk = (text: string) =>
  /\b(what('?s| is) (the |today'?s )?(date|time|day)( today| now)?|today'?s date|what day is (it|today)|what time is it|what year is it|what month is it|date today)\b/i.test(String(text || ''));

export type SharePx = { price: number | null; lastTrade?: string; marketStatus?: string | null; source?: string } | null | undefined;
export type TokenPx = { price: number; updatedAt?: number } | null | undefined;

const usd = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** One plain answer from the same feeds the Invest screen shows. Null when no live price. */
export function priceReply(ticker: string, share: SharePx, token: TokenPx): string | null {
  const st = STOCKS.find((s) => s.ticker === ticker);
  if (!st) return null;
  const parts: string[] = [];
  if (share && share.price != null && Number.isFinite(share.price)) {
    const when = share.lastTrade ? `, last trade ${share.lastTrade.replace(/^.*?(\w{3} \d{1,2}, \d{4}.*)$/, '$1')}` : '';
    const status = share.marketStatus ? `, market ${share.marketStatus.toLowerCase()}` : '';
    parts.push(`${st.name} shares are ${usd(share.price)} on ${share.source || 'Nasdaq.com'}${when}${status}.`);
  }
  if (token && Number.isFinite(token.price) && token.price > 0) {
    parts.push(`Pocket's paper ${st.token} token tracks it at ${usd(token.price)} (CoinGecko), and that is the price your trades use.`);
  }
  if (!parts.length) return null;
  return parts.join(' ') + ' This is test money, not advice.';
}

/** Today's date and time, given to the AI as a fact and used for direct answers. */
export function dateFacts(now: Date, tz?: string) {
  const zone = tz && /^[A-Za-z_]+(\/[A-Za-z_+-]+){0,2}$/.test(tz) ? tz : 'UTC';
  let local: string;
  try {
    local = now.toLocaleString('en-GB', { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  } catch {
    return { zone: 'UTC', local: now.toUTCString(), utc: now.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' };
  }
  return { zone, local, utc: now.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' };
}
export const dateReply = (now: Date, tz?: string) => { const d = dateFacts(now, tz); return `It is ${d.local} (${d.zone}).`; };
