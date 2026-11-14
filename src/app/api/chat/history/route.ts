import { handler } from '@/lib/server/http';
import { store } from '@/lib/server/store';
import { sessionOf } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
// Chat history lives only in the browser. The server keeps no chat text, so GET is always empty.
const th = (req: Request) => { const t = new URL(req.url).searchParams.get('thread') || ''; return /^[a-z0-9-]{1,40}$/.test(t) ? t : undefined; };
export const GET = handler(async (req) => { await sessionOf(req); return { items: [], stored: false }; });
// Deleting a chat in the app also removes any copy saved by older versions of Pocket (before 14 Nov 2026).
// With ?thread= it deletes that chat; without, every chat.
export const DELETE = handler(async (req) => { const a = (await sessionOf(req))!; await store.clearChat(a, th(req)); return { ok: true }; });
