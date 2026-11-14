import 'server-only';
// Server secrets come only from env. Never log them, never send them to the client.
export type KeyName = 'SPONSOR' | 'RELAYER' | 'MAKER' | 'FAUCET';
export function secretKey(name: KeyName): string | null {
  const v = process.env[`${name}_PRIVATE_KEY`];
  return v && v.startsWith('ed25519:') ? v : null;
}
export const has = (name: KeyName) => secretKey(name) !== null;
// AI provider: any OpenAI compatible API. Presets for Groq (free tier, default when GROQ_API_KEY is set)
// and NEAR AI Cloud (private TEE models). AI_* and STT_* env vars override everything.
const E = process.env;
const PRESETS = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', inUsd: 0.15, outUsd: 0.6, stt: 'whisper-large-v3', key: E.GROQ_API_KEY },
  nearai: { baseUrl: 'https://cloud-api.near.ai/v1', model: 'z-ai/glm-5.3-flash', inUsd: 0.08, outUsd: 0.5, stt: 'openai/whisper-large-v3', key: E.NEARAI_API_KEY },
} as const;
export const PROVIDER: keyof typeof PRESETS = (E.AI_PROVIDER as keyof typeof PRESETS) in PRESETS ? (E.AI_PROVIDER as keyof typeof PRESETS) : E.GROQ_API_KEY ? 'groq' : E.NEARAI_API_KEY ? 'nearai' : 'groq';
const P = PRESETS[PROVIDER];
export const AI = {
  provider: PROVIDER,
  label: E.AI_LABEL || (PROVIDER === 'groq' ? 'Groq' : 'NEAR AI Cloud'),
  baseUrl: E.AI_BASE_URL || P.baseUrl,
  apiKey: E.AI_API_KEY || P.key || '',
  model: E.AI_MODEL || P.model,
  // price per million tokens, used to meter credits fairly
  inUsd: Number(E.AI_INPUT_USD_PER_M || P.inUsd),
  outUsd: Number(E.AI_OUTPUT_USD_PER_M || P.outUsd),
  sttModel: E.STT_MODEL || P.stt,
  sttBaseUrl: E.STT_BASE_URL || E.AI_BASE_URL || P.baseUrl,
  sttKey: E.STT_API_KEY || E.AI_API_KEY || P.key || '',
};
export const DATABASE_URL = process.env.DATABASE_URL || '';
export const IS_LOCAL = process.env.POCKET_MODE === 'local' || process.env.NODE_ENV !== 'production';
// When the provider says no (no credit, bad key), Pocket stops calling it for a while and uses
// its built in parser and the browser's speech instead, without charging the user.
export const aiState = { downUntil: 0, reason: '', sttDownUntil: 0 };
export const aiUp = () => !!AI.apiKey && Date.now() > aiState.downUntil;
export const sttUp = () => !!AI.sttKey && Date.now() > aiState.sttDownUntil;
let probedAt = 0;
// Cheap check, at most every 10 minutes: does the AI provider accept our key and have credit?
export async function probeAI() {
  if (!AI.apiKey || Date.now() - probedAt < 10 * 60e3) return;
  probedAt = Date.now();
  try {
    const r = await fetch(AI.baseUrl.replace(/\/$/, '') + '/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${AI.apiKey}` }, signal: AbortSignal.timeout(8000), body: JSON.stringify({ model: AI.model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }) });
    if ([401, 402, 403].includes(r.status)) { aiState.downUntil = Date.now() + 10 * 60e3; aiState.reason = `provider said ${r.status}`; if (AI.sttKey === AI.apiKey) aiState.sttDownUntil = aiState.downUntil; }
  } catch { /* network blip, keep trying on real use */ }
}
