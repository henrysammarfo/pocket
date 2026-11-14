import { handler } from '@/lib/server/http';
import { stockDetail } from '@/lib/server/prices';
export const dynamic = 'force-dynamic';
export const GET = handler(async (req) => stockDetail(new URL(req.url).searchParams.get('sym') || ''));
