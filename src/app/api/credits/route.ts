import { handler } from '@/lib/server/http';
import { sessionOf } from '@/lib/server/auth';
import { creditsOf, COST } from '@/lib/server/credits';
import { aiUp, sttUp } from '@/lib/server/env';
export const dynamic = 'force-dynamic';
export const GET = handler(async (req) => { const a = (await sessionOf(req))!; return { ...(await creditsOf(a)), cost: COST, ai: aiUp(), stt: sttUp() }; });
