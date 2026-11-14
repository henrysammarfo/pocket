import { handler } from '@/lib/server/http';
import { validAccountId } from '@/lib/server/pool';
import { store, storeKind, HttpError } from '@/lib/server/store';
export const dynamic = 'force-dynamic';
export const GET = handler(async (req) => {
  const a = new URL(req.url).searchParams.get('account') || '';
  if (!validAccountId(a)) throw new HttpError(400, 'Bad account');
  return { store: storeKind, items: await store.activity(a, 50) };
});
