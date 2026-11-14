import { handler } from '@/lib/server/http';
import { fx } from '@/lib/server/prices';
export const dynamic = 'force-dynamic';
export const GET = handler(async () => fx());
