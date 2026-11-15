// Private AI only: with it on (the default), the provider chain holds only attested TEE providers,
// so a NEAR AI outage never sends words to Groq. With it off, Groq is the fallback.
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.stubEnv('NEARAI_API_KEY', 'test-near');
vi.stubEnv('GROQ_API_KEY', 'test-groq');
vi.stubEnv('AI_PROVIDER', 'nearai');
const L = await import('@/lib/server/llm');
const req = (h: Record<string, string> = {}) => new Request('https://x.test/api/chat', { headers: h });

describe('private AI only', () => {
  it('is on by default', () => expect(L.privateOnly()).toBe(true));
  it('the default chain is only private providers', () => expect(L.chain().map((p) => p.id)).toEqual(['nearai']));
  it('a request with x-pocket-private: 0 opts out', async () => expect(await L.withPrivacy(L.privateFrom(req({ 'x-pocket-private': '0' })), async () => L.chain().map((p) => p.id))).toEqual(['nearai', 'groq']));
  it('any other header value stays private', async () => expect(await L.withPrivacy(L.privateFrom(req({ 'x-pocket-private': 'no' })), async () => L.chain().map((p) => p.id))).toEqual(['nearai']));
  it('no header stays private', () => expect(L.privateFrom(req())).toBe(true));
  it('every provider in the private chain is marked private', () => expect(L.chain().every((p) => p.private)).toBe(true));
  it('groq is never marked private', () => expect(L.ORDER.find((p) => p.id === 'groq')?.private).toBe(false));
  it('the setting does not leak between requests', async () => {
    const [a, b] = await Promise.all([L.withPrivacy(false, async () => { await new Promise((r) => setTimeout(r, 5)); return L.chain().length; }), L.withPrivacy(true, async () => L.chain().length)]);
    expect([a, b]).toEqual([2, 1]);
  });
});
