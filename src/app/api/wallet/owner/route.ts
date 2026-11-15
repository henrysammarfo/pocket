import { body, handler, ipOf } from '@/lib/server/http';
import { submitOwner } from '@/lib/server/pool';
export const dynamic = 'force-dynamic';
// Owner messages signed by the recovery key (raise a limit, restore a phone, change owner keys).
export const POST = handler(async (req) => {
  const b = await body<{ account: string; payload: string; public_key: string; signature: string }>(req);
  return submitOwner(String(b.account), b.payload, b.public_key, b.signature, ipOf(req));
});
