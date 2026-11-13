import { body, handler, ipOf } from '@/lib/server/http';
import { faucet } from '@/lib/server/pool';
export const POST = handler(async (req) => faucet(String((await body(req)).account || ''), ipOf(req)));
