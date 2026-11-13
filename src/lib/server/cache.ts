import 'server-only';
type Entry = { t: number; v?: unknown; p?: Promise<unknown> };
const cache = new Map<string, Entry>();
// Cache with in flight de-duplication. On error, serve the last good value (its age stays visible to callers).
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<{ v: T; t: number }> {
  const c = cache.get(key);
  if (c && c.v !== undefined && Date.now() - c.t < ttlMs) return { v: c.v as T, t: c.t };
  if (c?.p) { await c.p.catch(() => {}); const n = cache.get(key); if (n?.v !== undefined) return { v: n.v as T, t: n.t }; }
  const p = fn();
  cache.set(key, { ...(c || { t: 0 }), p });
  try {
    const v = await p;
    const e = { t: Date.now(), v };
    cache.set(key, e);
    return { v, t: e.t };
  } catch (e) {
    if (c?.v !== undefined) { cache.set(key, { t: c.t, v: c.v }); return { v: c.v as T, t: c.t }; }
    cache.delete(key);
    throw e;
  }
}
