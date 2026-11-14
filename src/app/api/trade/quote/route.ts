import { body, handler } from '@/lib/server/http';
import { quote, validAccountId } from '@/lib/server/pool';
import { HttpError } from '@/lib/server/store';
export const POST = handler(async (req) => {
  const b = await body<{ account: string; side: 'buy' | 'sell'; symbol: string; usd?: number; qty?: number }>(req);
  if (!validAccountId(b.account) || !['buy', 'sell'].includes(b.side)) throw new HttpError(400, 'Bad quote request');
  return quote(b.account, b.side, String(b.symbol), { usd: b.usd != null ? Number(b.usd) : undefined, qty: b.qty != null ? Number(b.qty) : undefined });
});
