import { handler } from '@/lib/server/http';
import { balances, getLimit, usedToday, validAccountId } from '@/lib/server/pool';
import { HttpError } from '@/lib/server/store';
export const dynamic = 'force-dynamic';
export const GET = handler(async (req) => {
  const a = new URL(req.url).searchParams.get('account') || '';
  if (!validAccountId(a)) throw new HttpError(400, 'Bad account');
  const [b, limit, used] = await Promise.all([balances(a), getLimit(a), usedToday(a)]);
  return { ...b, limit, usedToday: used };
});
