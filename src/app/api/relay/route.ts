import { body, handler, ipOf } from '@/lib/server/http';
import { relay, type DelegateJson } from '@/lib/server/pool';
export const POST = handler(async (req) => relay(await body<DelegateJson>(req), ipOf(req)));
