import { body, handler, ipOf } from '@/lib/server/http';
import { settle } from '@/lib/server/pool';
export const POST = handler(async (req) => { const b = await body(req); return settle(b.quote, b.mac, b.signed, ipOf(req)); });
