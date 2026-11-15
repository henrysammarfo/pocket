import { handler, ipOf } from '@/lib/server/http';
import { priceAttest } from '@/lib/server/pool';
import { limit } from '@/lib/server/store';
export const dynamic = 'force-dynamic';
// A price signed by Pocket for the wallet contract (NEAR and paper stocks count against the dollar caps).
export const GET = handler(async (req) => {
  await limit('price:' + ipOf(req), 240, 3600);
  return priceAttest(new URL(req.url).searchParams.get('token') || '');
});
