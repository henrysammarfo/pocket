import { body, handler } from '@/lib/server/http';
import { store, HttpError } from '@/lib/server/store';
import { sessionOf } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export const GET = handler(async (req) => { const a = (await sessionOf(req))!; return { items: await store.memories(a) }; });
export const POST = handler(async (req) => {
  const a = (await sessionOf(req))!; const b = await body<{ text?: string; delete?: string }>(req);
  if (b.delete) { await store.deleteMemory(a, String(b.delete)); return { ok: true }; }
  const t = String(b.text || '').trim().slice(0, 200);
  if (!t) throw new HttpError(400, 'Write something to remember.');
  if (/(seed phrase|private key|password|secret)/i.test(t)) throw new HttpError(400, 'Pocket never stores keys, passwords or seed phrases.');
  if ((await store.memories(a)).length >= 50) throw new HttpError(400, 'Memory is full. Remove something first.');
  return { item: await store.addMemory(a, t) };
});
