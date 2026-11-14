import { handler } from '@/lib/server/http';
import { store } from '@/lib/server/store';
import { sessionOf } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
const th = (req: Request) => { const t = new URL(req.url).searchParams.get('thread') || ''; return /^[a-z0-9-]{1,40}$/.test(t) ? t : undefined; };
export const GET = handler(async (req) => { const a = (await sessionOf(req))!; return { items: await store.chats(a, 60, th(req) || 'main') }; });
// With ?thread= it deletes that chat; without, every chat (the old Clear chat).
export const DELETE = handler(async (req) => { const a = (await sessionOf(req))!; await store.clearChat(a, th(req)); return { ok: true }; });
