import { handler } from '@/lib/server/http';
import { store, HttpError } from '@/lib/server/store';
import { requestStatus, validRequestId } from '@/lib/shared/request';
export const dynamic = 'force-dynamic';
// Public view of one request: who asks, how much, and whether it is pending, paid or refunded.
export const GET = handler(async (req) => {
  const id = new URL(req.url).pathname.split('/').pop() || '';
  if (!validRequestId(id)) throw new HttpError(400, 'Bad request id.');
  const r = await store.getRequest(id);
  if (!r) throw new HttpError(404, 'This request does not exist.');
  return { ...r, ...requestStatus(r, await store.activity(r.account, 500)) };
});
