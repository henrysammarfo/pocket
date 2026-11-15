import { body, handler } from '@/lib/server/http';
import { receiverCheck, validAccountId } from '@/lib/server/pool';
import { HttpError, limit } from '@/lib/server/store';
import { ipOf } from '@/lib/server/http';
export const dynamic = 'force-dynamic';
// Who would get the money: allow, warn or block, with reasons. Contacts come from the app (they live on the device).
export const POST = handler(async (req) => {
  const b = await body<{ from?: string; to?: string; contacts?: { name?: unknown; account?: unknown }[] }>(req);
  if (!validAccountId(b.from)) throw new HttpError(400, 'Bad sender.');
  await limit('recv:' + ipOf(req), 300, 3600);
  const contacts = (Array.isArray(b.contacts) ? b.contacts : []).slice(0, 200)
    .filter((c) => typeof c?.account === 'string' && typeof c?.name === 'string')
    .map((c) => ({ name: String(c.name).slice(0, 40), account: String(c.account).toLowerCase() }));
  return receiverCheck(b.from, String(b.to || ''), contacts);
});
