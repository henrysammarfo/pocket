import 'server-only';
import { NextResponse } from 'next/server';
import { HttpError } from './store';
import { PolicyError } from '../shared/policy';

// Client IP for rate limits. On Vercel, x-vercel-forwarded-for and x-real-ip are set by the edge and
// cannot be forged by the client; a raw x-forwarded-for is only used when neither exists (self host).
export function ipOf(req: Request) {
  const h = (k: string) => (req.headers.get(k) || '').split(',')[0].trim();
  return h('x-vercel-forwarded-for') || h('x-real-ip') || h('x-forwarded-for') || 'local';
}
export function handler<T>(fn: (req: Request) => Promise<T>) {
  return async (req: Request) => {
    try {
      const v = await fn(req);
      return NextResponse.json(v, { headers: { 'cache-control': 'no-store' } });
    } catch (e) {
      const known = e instanceof HttpError || e instanceof PolicyError;
      const status = known ? (e as HttpError).status : 500;
      const msg = e instanceof Error ? e.message : String(e);
      if (status >= 500 && !known) console.error('[pocket]', msg);
      return NextResponse.json({ error: status >= 500 && !known ? 'Something went wrong on the server. ' + msg.slice(0, 160) : msg }, { status });
    }
  };
}
export async function body<T = any>(req: Request): Promise<T> {
  const t = await req.text();
  if (t.length > 64_000) throw new HttpError(413, 'Request too large.');
  try { return JSON.parse(t) as T; } catch { throw new HttpError(400, 'Send JSON.'); }
}
