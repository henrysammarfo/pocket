import { body, handler } from '@/lib/server/http';
import { store, HttpError } from '@/lib/server/store';
import { sessionOf } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export const GET = handler(async (req) => { const a = (await sessionOf(req))!; return { items: await store.threads(a) }; });
export const PATCH = handler(async (req) => {
  const a = (await sessionOf(req))!; const b = await body<{ id?: string; title?: string }>(req);
  if (!b.id || !/^[a-z0-9-]{1,40}$/.test(b.id) || !String(b.title || '').trim()) throw new HttpError(400, 'Give the chat a name.');
  await store.renameThread(a, b.id, String(b.title)); return { ok: true };
});
