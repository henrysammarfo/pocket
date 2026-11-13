import { handler } from '@/lib/server/http';
import { coinDetail } from '@/lib/server/prices';
import { HttpError } from '@/lib/server/store';
export const dynamic = 'force-dynamic';
export const GET = handler(async (req) => {
  const id = new URL(req.url).searchParams.get('id');
  if (id !== 'near' && id !== 'usd-coin') throw new HttpError(400, 'Unknown coin');
  return coinDetail(id);
});
