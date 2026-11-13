import { handler } from '@/lib/server/http';
import { store } from '@/lib/server/store';
import { sessionOf } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
export const GET = handler(async (req) => { const a = (await sessionOf(req))!; return { items: await store.chats(a, 60) }; });
export const DELETE = handler(async (req) => { const a = (await sessionOf(req))!; await store.clearChat(a); return { ok: true }; });
