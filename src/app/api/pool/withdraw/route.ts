import { body, handler, ipOf } from '@/lib/server/http';
import { poolWithdraw } from '@/lib/server/pool';
export const maxDuration = 60;
export const POST = handler(async (req) => poolWithdraw(await body(req), ipOf(req)));
