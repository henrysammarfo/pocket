// Plans: the only thing the assistant can make. A plan never moves money; the user approves
// it on their own device, and each step is signed by the device key.
export type SendStep = { type: 'send'; to: string; toLabel: string; amount: number; asset: 'auto' | 'pUSD' | 'USDC' | 'NEAR'; note?: string };
export type TradeStep = { type: 'buy' | 'sell'; ticker: string; usd?: number; qty?: number };
export type Step = SendStep | TradeStep;
export type Plan = { id: string; steps: Step[]; summary: string };
export type Ctx = { dollars: number; pusd: number; usdc: number; near: number; holdings: Record<string, number>; keep: number; limit: number; usedToday: number; prices: Record<string, number> };
export type Check = { ok: boolean; reasons: string[]; after: number; sendTotal: number; tradeTotal: number };

const TICKERS: Record<string, string> = { tesla: 'TSLA', tsla: 'TSLA', tslaon: 'TSLA', nvidia: 'NVDA', nvda: 'NVDA', nvdaon: 'NVDA', apple: 'AAPL', aapl: 'AAPL', aaplon: 'AAPL', 's&p': 'SPY', 'sp500': 'SPY', 's&p 500': 'SPY', spy: 'SPY', spyon: 'SPY', nasdaq: 'QQQ', 'nasdaq 100': 'QQQ', qqq: 'QQQ', qqqon: 'QQQ' };
export const tickerOf = (s: string) => TICKERS[s.toLowerCase().trim()] || null;

// Rules are enforced in code, here and again on the server for sends.
export function checkPlan(p: Plan, c: Ctx): Check {
  const reasons: string[] = [];
  let sendTotal = 0, nearTotal = 0, buyTotal = 0, sellTotal = 0;
  for (const s of p.steps) {
    if (s.type === 'send') {
      if (!(s.amount > 0) || !Number.isFinite(s.amount)) reasons.push('A send needs an amount above zero.');
      else if (s.asset !== 'NEAR' && s.amount < 0.01) reasons.push('Dollar sends start at one cent.');
      else if (s.asset === 'NEAR' && s.amount < 0.00001) reasons.push('NEAR sends start at 0.00001 NEAR.');
      if (s.asset !== 'NEAR') sendTotal += s.amount; else nearTotal += s.amount;
    } else {
      const px = c.prices[s.ticker] || 0;
      const usd = s.usd ?? (s.qty ?? 0) * px;
      if (!(usd >= 0.01) || !Number.isFinite(usd)) reasons.push(`The ${s.ticker} trade needs an amount of at least one cent.`);
      if (usd > 1000) reasons.push(`Paper trades are capped at $1,000 each. ${s.ticker} asks for $${usd.toFixed(2)}.`);
      if (s.type === 'buy') buyTotal += usd; else {
        sellTotal += usd;
        const have = (c.holdings[s.ticker] || 0) * px;
        if (usd > have + 0.01) reasons.push(`You hold about $${have.toFixed(2)} of ${s.ticker}, so you cannot sell $${usd.toFixed(2)}.`);
      }
    }
  }
  const after = c.dollars - sendTotal - buyTotal + sellTotal;
  if (after < c.keep - 1e-9) reasons.push(`Your rule keeps $${c.keep.toFixed(0)}. This plan would leave $${Math.max(after, 0).toFixed(2)}.`);
  if (after < -1e-9) reasons.push(`You have $${c.dollars.toFixed(2)}, and this plan needs $${(sendTotal + buyTotal - sellTotal).toFixed(2)}.`);
  if (nearTotal > 0 && nearTotal > c.near + 1e-12) reasons.push(`You have ${c.near} NEAR, and this plan sends ${nearTotal} NEAR.`);
  if (nearTotal > 5) reasons.push('NEAR sends are capped at 5 NEAR on testnet.');
  const left = Math.max(0, c.limit - c.usedToday);
  if (sendTotal > left + 1e-9) reasons.push(`Your daily send limit is $${c.limit.toFixed(0)}, and $${left.toFixed(2)} is left today.`);
  return { ok: reasons.length === 0, reasons, after, sendTotal, tradeTotal: buyTotal + sellTotal };
}

// Deterministic parser for money commands. Used when no AI key is set and as a cross check.
const NUM = String.raw`\$?\s?(\d+(?:[.,]\d+)?)\s?(?:usd|dollars?|bucks|usdc|pusd|cedis?)?`;
export function parseCommand(text: string): Step[] | null {
  const steps: Step[] = [];
  const parts = text.replace(/[.!?]+$/g, '').split(/\s*(?:,|\band then\b|\bthen\b|\band\b|;)\s*/i).filter(Boolean);
  let lastVerb = '';
  for (const raw of parts) {
    const p = raw.trim();
    let m = p.match(new RegExp(String.raw`^(?:please\s+)?(?:send|pay|give|transfer)\s+(?:my\s+)?(.+?)\s+${NUM}(?:\s+(?:for|note)\s+(.+))?$`, 'i'));
    if (m && !/^\$?\d/.test(m[1])) { steps.push({ type: 'send', to: clean(m[1]), toLabel: clean(m[1]), amount: num(m[2]), asset: 'auto', note: m[3] }); lastVerb = 'send'; continue; }
    m = p.match(new RegExp(String.raw`^(?:please\s+)?(?:send|pay|give|transfer)\s+${NUM}\s+to\s+(?:my\s+)?(.+?)(?:\s+(?:for|note)\s+(.+))?$`, 'i'));
    if (m) { steps.push({ type: 'send', to: clean(m[2]), toLabel: clean(m[2]), amount: num(m[1]), asset: 'auto', note: m[3] }); lastVerb = 'send'; continue; }
    m = p.match(new RegExp(String.raw`^(?:(?:buy|invest)\s+)?(?:put\s+)?${NUM}\s+(?:of\s+|in(?:to)?\s+|on\s+)?([a-z&\s0-9]+?)(?:\s+stocks?|\s+shares?)?$`, 'i'));
    if (m && tickerOf(m[2]) && (/^(buy|invest|put)/i.test(p) || lastVerb === 'buy' || /\bput\b|\bin\b/i.test(p))) { steps.push({ type: 'buy', ticker: tickerOf(m[2])!, usd: num(m[1]) }); lastVerb = 'buy'; continue; }
    m = p.match(new RegExp(String.raw`^(?:buy|invest)\s+(?:in\s+)?([a-z&\s0-9]+?)\s+(?:for|with)\s+${NUM}$`, 'i'));
    if (m && tickerOf(m[1])) { steps.push({ type: 'buy', ticker: tickerOf(m[1])!, usd: num(m[2]) }); lastVerb = 'buy'; continue; }
    m = p.match(new RegExp(String.raw`^sell\s+${NUM}\s+(?:of\s+|worth of\s+)?(?:my\s+)?([a-z&\s0-9]+?)(?:\s+stocks?|\s+shares?)?$`, 'i'));
    if (m && tickerOf(m[2])) { steps.push({ type: 'sell', ticker: tickerOf(m[2])!, usd: num(m[1]) }); lastVerb = 'sell'; continue; }
    if (steps.length && /^(?:put\s+)?\$?\d/.test(p)) {
      m = p.match(new RegExp(String.raw`^(?:put\s+)?${NUM}\s+(?:in(?:to)?\s+|of\s+)?([a-z&\s0-9]+)$`, 'i'));
      if (m && tickerOf(m[2])) { steps.push({ type: 'buy', ticker: tickerOf(m[2])!, usd: num(m[1]) }); continue; }
    }
    if (steps.length) return null;
  }
  return steps.length ? steps : null;
}
const num = (s: string) => Number(s.replace(',', '.'));
const clean = (s: string) => s.replace(/^(?:to\s+)/i, '').replace(/\s+in\s+[a-z\s]+$/i, '').trim();
