import 'server-only';
// AI provider chain. NEAR AI Cloud runs open models inside attested TEEs (Intel TDX plus NVIDIA GPU),
// so prompts, photos and voice stay private; `npm run verify:tee` checks the attestation. Groq is the
// automatic fallback when NEAR AI errors, rate limits, or reaches Pocket's daily spend cap.
// Every call logs its model, tokens and cost (never the content) so spend can be watched.
import { store } from './store';

export type ProvId = 'nearai' | 'groq';
export type Prov = { id: ProvId; label: string; private: boolean; baseUrl: string; key: string; chat: string; vision: string; stt: string; inUsd: number; outUsd: number; vInUsd: number; vOutUsd: number; extra: Record<string, unknown> };
const E = process.env;
const P: Record<ProvId, Prov> = {
  nearai: { id: 'nearai', label: 'NEAR AI Cloud (private TEE)', private: true, baseUrl: E.NEARAI_BASE_URL || 'https://cloud-api.near.ai/v1', key: E.NEARAI_API_KEY || '',
    chat: E.NEARAI_MODEL || 'Qwen/Qwen3.6-35B-A3B-FP8', vision: E.NEARAI_VISION_MODEL || 'Qwen/Qwen3-VL-30B-A3B-Instruct', stt: E.NEARAI_STT_MODEL || 'openai/whisper-large-v3',
    inUsd: 0.17, outUsd: 1.1, vInUsd: 0.15, vOutUsd: 0.55, extra: { chat_template_kwargs: { enable_thinking: false } } },
  groq: { id: 'groq', label: 'Groq', private: false, baseUrl: 'https://api.groq.com/openai/v1', key: E.GROQ_API_KEY || '',
    chat: E.GROQ_MODEL || 'openai/gpt-oss-120b', vision: E.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b', stt: 'whisper-large-v3',
    inUsd: 0.15, outUsd: 0.6, vInUsd: 0.15, vOutUsd: 0.6, extra: { reasoning_effort: 'low' } },
};
const first: ProvId = E.AI_PROVIDER === 'groq' ? 'groq' : E.AI_PROVIDER === 'nearai' ? 'nearai' : P.nearai.key ? 'nearai' : 'groq';
export const ORDER: Prov[] = [P[first], P[first === 'nearai' ? 'groq' : 'nearai']].filter((p) => p.key);
export const PRIMARY: Prov | null = ORDER[0] || null;
export const groq = P.groq.key ? P.groq : null;

// Rest a provider after it fails: 10 minutes for auth or credit problems, as long as asked for rate limits.
const down: Record<string, number> = {};
const rest = (k: string, r: Response | null) => { const s = r ? ([401, 402, 403].includes(r.status) ? 600 : r.status === 429 ? Math.min(120, Number(r.headers.get('retry-after')) || 20) : 30) : 30; down[k] = Date.now() + s * 1000; };
export const isUp = (p: Prov, kind: 'chat' | 'stt' = 'chat') => !!p.key && Date.now() > (down[p.id + kind] || 0);
export const anyUp = (kind: 'chat' | 'stt' = 'chat') => ORDER.some((p) => isUp(p, kind));

// NEAR AI credits are prepaid ($10 to last to 25 Nov), so cap the daily spend on the server.
const CAP = Number(E.NEARAI_USD_PER_DAY || 0.8);
const dayKey = () => 'nearai:usd:' + new Date().toISOString().slice(0, 10);
export async function nearaiSpentToday() { return (await store.get(dayKey())) / 1e6; }
async function underCap(p: Prov) { return p.id !== 'nearai' || (await nearaiSpentToday()) < CAP; }
async function record(p: Prov, model: string, usd: number, tin: number, tout: number) {
  if (p.id === 'nearai' && usd > 0) await store.incr(dayKey(), 2 * 86400, Math.ceil(usd * 1e6)).catch(() => {});
  console.info(JSON.stringify({ ai: p.id, model, tin, tout, usd: Number(usd.toFixed(6)) }));
}

export type ChatResult = { j: any; prov: Prov; model: string; usd: number };
// One chat completion through the chain. `vision` picks each provider's vision model.
export async function complete(body: Record<string, unknown>, opts: { vision?: boolean; timeoutMs?: number; tools?: boolean } = {}): Promise<ChatResult> {
  let last = 'no AI provider is set up';
  for (const p of ORDER) {
    if (!isUp(p) || !(await underCap(p))) { last = p.id + (isUp(p) ? ' is at its daily cap' : ' is resting'); continue; }
    const model = opts.vision ? p.vision : p.chat;
    const ask = () => fetch(p.baseUrl.replace(/\/$/, '') + '/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${p.key}` }, signal: AbortSignal.timeout(opts.timeoutMs || 40000), body: JSON.stringify({ ...body, ...(opts.vision ? {} : p.extra), model }) });
    try {
      let r = await ask();
      // Models sometimes write a malformed tool call (400 tool_use_failed); one retry fixes most.
      if (r.status === 400) { const t = await r.clone().text(); if (/tool_use_failed|failed_generation/.test(t)) r = await ask(); }
      if (r.status === 429) { const w = Number(r.headers.get('retry-after')) || 0; if (w > 0 && w <= 6) { await new Promise((ok) => setTimeout(ok, w * 1000 + 300)); r = await ask(); } }
      if (!r.ok) { last = `${p.id} ${r.status} ${(await r.text()).slice(0, 200)}`; console.warn(JSON.stringify({ ai: p.id, fallback: true, status: r.status })); if (r.status === 429 || r.status >= 500 || [401, 402, 403].includes(r.status)) rest(p.id + 'chat', r); continue; }
      const j = await r.json();
      const tin = j.usage?.prompt_tokens || 0, tout = j.usage?.completion_tokens || 0;
      const usd = (tin * (opts.vision ? p.vInUsd : p.inUsd) + tout * (opts.vision ? p.vOutUsd : p.outUsd)) / 1e6;
      await record(p, model, usd, tin, tout);
      return { j, prov: p, model, usd };
    } catch (e) { last = `${p.id} ${e instanceof Error ? e.message : String(e)}`; rest(p.id + 'chat', null); }
  }
  throw new Error(last);
}

// Speech to text through the chain (NEAR AI Whisper first, then Groq Whisper).
export async function transcribe(make: (p: Prov) => FormData): Promise<{ j: any; prov: Prov }> {
  let last = 'no speech service is set up';
  for (const p of ORDER) {
    if (!isUp(p, 'stt') || !(await underCap(p))) continue;
    try {
      const r = await fetch(p.baseUrl.replace(/\/$/, '') + '/audio/transcriptions', { method: 'POST', headers: { authorization: `Bearer ${p.key}` }, body: make(p), signal: AbortSignal.timeout(55000) });
      if (!r.ok) { last = `${p.id} ${r.status}`; console.warn(JSON.stringify({ ai: p.id, kind: 'stt', fallback: true, status: r.status })); if (r.status === 429 || r.status >= 500 || [401, 402, 403].includes(r.status)) rest(p.id + 'stt', r); continue; }
      const j = await r.json(); await record(p, p.stt, p.id === 'nearai' ? 0.0001 : 0, 0, 0); return { j, prov: p };
    } catch (e) { last = `${p.id} ${e instanceof Error ? e.message : String(e)}`; rest(p.id + 'stt', null); }
  }
  throw new Error(last);
}
