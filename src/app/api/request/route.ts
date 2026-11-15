import { body, handler } from '@/lib/server/http';
import { sessionOf } from '@/lib/server/auth';
import { store, limit, HttpError } from '@/lib/server/store';
import { cleanRequest, newRequestId, requestPath, requestStatus } from '@/lib/shared/request';
import { ROOT } from '@/lib/shared/deployment';
export const dynamic = 'force-dynamic';
// Your money requests with their live status (pending, paid or refunded).
export const GET = handler(async (req) => {
  const a = (await sessionOf(req))!;
  const [reqs, acts] = await Promise.all([store.requests(a, 50), store.activity(a, 500)]);
  return { items: reqs.map((r) => ({ ...r, ...requestStatus(r, acts), path: requestPath(a.slice(0, -ROOT.length - 1), r.id) })) };
});
// Make a request link. Only the account owner (signed session) can ask for money to their own account.
export const POST = handler(async (req) => {
  const a = (await sessionOf(req))!;
  await limit('req:' + a, 30, 3600);
  const c = cleanRequest(await body(req));
  if (!c.ok) throw new HttpError(400, c.reason);
  const r = { id: newRequestId(), account: a, amount: c.amount, token: c.token, note: c.note, at: Date.now() };
  await store.addRequest(r);
  return { ...r, status: 'pending', path: requestPath(a.slice(0, -ROOT.length - 1), r.id) };
});
