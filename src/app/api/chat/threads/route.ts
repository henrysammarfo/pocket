import { body, handler } from '@/lib/server/http';
import { HttpError } from '@/lib/server/store';
import { sessionOf } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
// The chat list lives only in the browser. The server keeps no chat titles or text.
export const GET = handler(async (req) => { await sessionOf(req); return { items: [], stored: false }; });
// Renames are saved in the browser; the server accepts the call for older clients and stores nothing.
export const PATCH = handler(async (req) => {
  await sessionOf(req); const b = await body<{ id?: string; title?: string }>(req);
  if (!b.id || !/^[a-z0-9-]{1,40}$/.test(b.id) || !String(b.title || '').trim()) throw new HttpError(400, 'Give the chat a name.');
  return { ok: true, stored: false };
});
