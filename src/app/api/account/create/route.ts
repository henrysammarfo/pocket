import { body, handler, ipOf } from '@/lib/server/http';
import { createAccount } from '@/lib/server/pool';
export const POST = handler(async (req) => { const b = await body<{ username: string; publicKey: string }>(req); return createAccount(String(b.username || ''), String(b.publicKey || ''), ipOf(req)); });
