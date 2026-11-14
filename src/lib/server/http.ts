import 'server-only';
import { NextResponse } from 'next/server';
import { HttpError } from './store';

export function ipOf(req: Request) {
  return (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('x-real-ip') || 'local';
}
export function handler<T>(fn: (req: Request) => Promise<T>) {
  return async (req: Request) => {
    try {
      const v = await fn(req);
      return NextResponse.json(v, { headers: { 'cache-control': 'no-store' } });
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      const msg = e instanceof Error ? e.message : String(e);
      if (status >= 500 && !(e instanceof HttpError)) console.error('[pocket]', msg);
      return NextResponse.json({ error: status >= 500 && !(e instanceof HttpError) ? 'Something went wrong on the server. ' + msg.slice(0, 160) : msg }, { status });
    }
  };
}
export async function body<T = any>(req: Request): Promise<T> {
  const t = await req.text();
  if (t.length > 64_000) throw new HttpError(413, 'Request too large.');
  try { return JSON.parse(t) as T; } catch { throw new HttpError(400, 'Send JSON.'); }
}
