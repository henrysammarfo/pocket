import { handler } from '@/lib/server/http';
import { receipt } from '@/lib/server/receipt';
export const dynamic = 'force-dynamic';
export const GET = handler(async (req) => receipt(new URL(req.url).searchParams.get('tx') || ''));
