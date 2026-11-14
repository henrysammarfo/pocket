import { handler } from '@/lib/server/http';
import { sessionOf } from '@/lib/server/auth';
import { creditsOf, COST } from '@/lib/server/credits';
import { PRIMARY, anyUp } from '@/lib/server/llm';
export const dynamic = 'force-dynamic';
export const GET = handler(async (req) => { const a = (await sessionOf(req))!; return { ...(await creditsOf(a)), cost: COST, ai: anyUp(), stt: anyUp('stt'), provider: PRIMARY?.label || null, private: !!PRIMARY?.private, model: PRIMARY?.chat || null }; });
