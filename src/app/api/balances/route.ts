import { handler } from '@/lib/server/http';
import { balances, getLimit, usedToday, validAccountId, walletOf } from '@/lib/server/pool';
import { HttpError } from '@/lib/server/store';
export const dynamic = 'force-dynamic';
export const GET = handler(async (req) => {
  const a = new URL(req.url).searchParams.get('account') || '';
  if (!validAccountId(a)) throw new HttpError(400, 'Bad account');
  const [b, limit, used, w] = await Promise.all([balances(a), getLimit(a), usedToday(a), walletOf(a)]);
  return { ...b, limit, usedToday: used, onchain: w ? { limits: w.limits, pending: w.pending, spentUsd: w.spentUsd } : null };
});
