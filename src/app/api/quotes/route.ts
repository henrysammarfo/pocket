import { handler } from '@/lib/server/http';
import { quotes } from '@/lib/server/prices';
export const dynamic = 'force-dynamic';
export const GET = handler(async () => quotes());
