import { body, handler } from '@/lib/server/http';
import { setLimit } from '@/lib/server/pool';
export const POST = handler(async (req) => setLimit((await body(req)).signed));
