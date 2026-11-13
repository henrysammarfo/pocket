import { body, handler, ipOf } from '@/lib/server/http';
import { submitTransfer } from '@/lib/server/pool';
export const POST = handler(async (req) => submitTransfer((await body(req)).signed, ipOf(req)));
