import { handler, ipOf } from '@/lib/server/http';
import { limit } from '@/lib/server/store';
import { attestAll } from '@/lib/server/attest';
export const dynamic = 'force-dynamic';
export const maxDuration = 40;
// GET /api/attest: a fresh TEE attestation check of every NEAR AI Cloud model Pocket uses, with a new
// random nonce per model on every call. Public and key free; rate limited per IP because each call
// asks NEAR AI Cloud for new hardware evidence.
export const GET = handler(async (req) => {
  await limit('attest:' + ipOf(req), Number(process.env.ATTEST_PER_IP_HOUR || 30), 3600);
  return attestAll();
});
