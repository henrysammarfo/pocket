// Privacy: the server must never keep chat text. These tests run the real /api/chat route against the
// real store module (in memory mode) with the AI and the session check mocked, and assert that nothing
// about the conversation is written, and that the history and thread routes return nothing.
import { describe, expect, it, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server/auth', () => ({ sessionOf: vi.fn(async () => 'ama.pocketnear.testnet') }));
vi.mock('@/lib/server/llm', () => ({ anyUp: () => true, privateFrom: () => true, withPrivacy: (_p: boolean, f: () => unknown) => f() }));
vi.mock('@/lib/server/vision', () => ({ okImage: () => true, visionUp: () => true, readImage: async () => ({ text: 'Total 12.50', usd: 0 }) }));
vi.mock('@/lib/server/credits', () => ({ COST: { chat: 1, photo: 1 }, creditsOf: async () => 1000, refund: async () => {}, settleUsage: async () => {}, spend: async () => {} }));
vi.mock('@/lib/server/brain', () => ({
  chat: async () => ({ reply: 'Your secret plan to buy a red bicycle is noted.', source: 'ai' }),
  planFrom: () => ({ reply: 'Plan ready.', source: 'rules' }),
}));

const ACCOUNT = 'ama.pocketnear.testnet';
const SECRET = 'my secret plan to buy a red bicycle';
const req = (url: string, init?: RequestInit) => new Request('http://localhost' + url, { headers: { 'content-type': 'application/json', 'x-pocket-session': 'x' }, ...init });

describe('chat privacy: no chat text on the server', () => {
  beforeEach(() => { delete process.env.DATABASE_URL; });

  it('POST /api/chat writes nothing about the conversation to the store', async () => {
    const { store } = await import('@/lib/server/store');
    const calls: string[] = [];
    // Watch every store method. Rate limit counters (incr/get) and saved memories are allowed; anything else is not.
    for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(store))) {
      const f = (store as unknown as Record<string, unknown>)[k];
      if (typeof f === 'function' && k !== 'constructor') (store as unknown as Record<string, unknown>)[k] = (...a: unknown[]) => { calls.push(k + ' ' + JSON.stringify(a)); return (f as (...x: unknown[]) => unknown).apply(store, a); };
    }
    const { POST } = await import('@/app/api/chat/route');
    const r = await POST(req('/api/chat', { method: 'POST', body: JSON.stringify({ messages: [{ role: 'user', content: SECRET }], ctx: { dollars: 100 }, thread: 'abc' }) }));
    expect(r.status).toBe(200);
    expect((await r.json()).reply).toContain('noted');
    expect(calls.some((c) => c.startsWith('incr '))).toBe(true); // the spy really sees store calls
    const writes = calls.filter((c) => !/^(incr|get|memories) /.test(c));
    expect(writes).toEqual([]);
    expect(calls.join('\n')).not.toContain('red bicycle');
    expect('addChat' in store).toBe(false);
  });

  it('GET history and threads return nothing and say nothing is stored', async () => {
    const h = await import('@/app/api/chat/history/route');
    const t = await import('@/app/api/chat/threads/route');
    expect(await (await h.GET(req('/api/chat/history?thread=abc'))).json()).toEqual({ items: [], stored: false });
    expect(await (await t.GET(req('/api/chat/threads'))).json()).toEqual({ items: [], stored: false });
    expect((await (await t.PATCH(req('/api/chat/threads', { method: 'PATCH', body: JSON.stringify({ id: 'abc', title: SECRET }) }))).json()).stored).toBe(false);
  });

  it('no server code inserts into the chat tables', () => {
    const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    const files = [...walk('src/app/api'), ...walk('src/lib/server')].filter((f) => /\.tsx?$/.test(f));
    for (const f of files) {
      const s = fs.readFileSync(f, 'utf8');
      expect(s, f).not.toMatch(/insert into pocket_(chat|thread)/i);
      expect(s, f).not.toMatch(/\baddChat\(/);
    }
    void ACCOUNT;
  });
});
