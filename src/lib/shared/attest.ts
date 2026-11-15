// Live TEE attestation checks for NEAR AI Cloud, shared by the server (/api/attest, npm run verify:tee)
// and the browser (Settings > Private AI runs it directly, so the user does not have to trust Pocket's
// server: the browser makes its own nonce and NEAR AI Cloud answers it with CORS allowed).
// See src/lib/server/attest.ts for what each check means.
import { keccak_256 } from '@noble/hashes/sha3.js';

export type Check = { id: string; label: string; ok: boolean; detail?: string };
export type ModelReport = { role: 'chat' | 'vision' | 'voice'; title: string; model: string; ok: boolean; instances: number; signer?: string; checks: Check[]; error?: string; ms: number };
export type AttestReport = { ok: boolean; provider: string; checkedAt: string; models: ModelReport[]; notChecked: string; verifyUrl: string };

const BASE = process.env.NEARAI_BASE_URL || 'https://cloud-api.near.ai/v1';
export const ATTEST_MODELS: { role: ModelReport['role']; title: string; model: string }[] = [
  { role: 'chat', title: 'Chat and plans', model: process.env.NEARAI_MODEL || 'Qwen/Qwen3.6-35B-A3B-FP8' },
  { role: 'vision', title: 'Receipts and bills', model: process.env.NEARAI_VISION_MODEL || 'Qwen/Qwen3-VL-30B-A3B-Instruct' },
  { role: 'voice', title: 'Voice notes', model: process.env.NEARAI_STT_MODEL || 'openai/whisper-large-v3' },
];

// TDX quote v4: 48 byte header, TD report body after it; report_data is the last 64 bytes of the body.
const fromHex = (h: string) => { const s = String(h || '').replace(/^0x/, ''); if (!/^([0-9a-fA-F]{2})*$/.test(s)) return new Uint8Array(0); return Uint8Array.from(s.match(/../g) || [], (x) => parseInt(x, 16)); };
const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
export function readQuote(hex: string) {
  const q = fromHex(hex);
  if (q.length < 632) return { version: 0, tee: 0, reportData: '' };
  const dv = new DataView(q.buffer, q.byteOffset, q.byteLength);
  return { version: dv.getUint16(0, true), tee: dv.getUint32(4, true), reportData: toHex(q.subarray(568, 632)) };
}
export const isTdx = (q: { version: number; tee: number }) => q.version === 4 && q.tee === 0x81;
export function addressOfKey(pub: string) {
  return toHex(keccak_256(fromHex(String(pub).replace(/^0x/, '').replace(/^04/, ''))).subarray(12));
}

type Raw = { gateway_attestation?: { intel_quote?: string; report_data?: string }; model_attestations?: { intel_quote: string; signing_address: string; signing_public_key: string; nvidia_payload?: string }[] };

// Pure: grade one attestation response against the nonce we sent. Exported for unit tests.
export function grade(rep: Raw, nonce: string): { checks: Check[]; instances: number; signer?: string } {
  const g = readQuote(rep.gateway_attestation?.intel_quote || '');
  const models = rep.model_attestations || [];
  const per = models.map((m) => {
    const q = readQuote(m.intel_quote);
    const addr = String(m.signing_address || '').replace(/^0x/, '').toLowerCase();
    let gpuNonce: string | null = null; try { gpuNonce = JSON.parse(m.nvidia_payload || '{}').nonce ?? null; } catch { /* missing */ }
    return { tdx: isTdx(q), fresh: q.reportData.slice(64) === nonce, bound: !!addr && q.reportData.slice(0, 40) === addr, keyed: !!addr && addressOfKey(m.signing_public_key) === addr, gpu: gpuNonce === nonce, addr };
  });
  const all = (k: 'tdx' | 'fresh' | 'bound' | 'keyed' | 'gpu') => per.length > 0 && per.every((p) => p[k]);
  const n = per.length;
  const of = (k: 'tdx' | 'fresh' | 'bound' | 'keyed' | 'gpu') => `${per.filter((p) => p[k]).length} of ${n} instance${n === 1 ? '' : 's'}`;
  return {
    instances: n,
    signer: per[0]?.addr ? '0x' + per[0].addr : undefined,
    checks: [
      { id: 'gateway', label: 'Gateway runs in Intel TDX, quote is fresh', ok: isTdx(g) && g.reportData.endsWith(nonce) && rep.gateway_attestation?.report_data === g.reportData, detail: isTdx(g) ? `TDX quote v${g.version}` : 'No valid TDX quote' },
      { id: 'tdx', label: 'Model runs in Intel TDX', ok: all('tdx'), detail: of('tdx') },
      { id: 'fresh', label: 'Evidence made just now for this check', ok: all('fresh'), detail: 'Bound to a new random nonce' },
      { id: 'key', label: 'Reply signing key lives in the enclave', ok: all('bound') && all('keyed'), detail: of('keyed') },
      { id: 'gpu', label: 'NVIDIA confidential GPU evidence is fresh', ok: all('gpu'), detail: of('gpu') },
    ],
  };
}

async function one(m: { role: ModelReport['role']; title: string; model: string }): Promise<ModelReport> {
  const t0 = Date.now();
  const nonce = toHex(globalThis.crypto.getRandomValues(new Uint8Array(32)));
  try {
    const r = await fetch(`${BASE}/attestation/report?model=${encodeURIComponent(m.model)}&nonce=${nonce}&signing_algo=ecdsa`, { signal: AbortSignal.timeout(25000), cache: 'no-store' });
    if (!r.ok) throw new Error(`NEAR AI Cloud answered HTTP ${r.status}`);
    const g = grade(await r.json(), nonce);
    return { ...m, ...g, ok: g.checks.every((c) => c.ok), ms: Date.now() - t0 };
  } catch (e) {
    return { ...m, ok: false, instances: 0, checks: [], error: e instanceof Error ? e.message.slice(0, 160) : 'Check failed', ms: Date.now() - t0 };
  }
}

/** Runs anywhere: on the server for /api/attest, and in the browser so the check does not trust Pocket's server. */
export async function attestAll(list: { role: ModelReport['role']; title: string; model: string }[] = ATTEST_MODELS): Promise<AttestReport> {
  const models = await Promise.all(list.map(one));
  return {
    ok: models.every((m) => m.ok), provider: 'NEAR AI Cloud', checkedAt: new Date().toISOString(), models,
    notChecked: 'Intel and NVIDIA certificate chains are verified by NEAR AI. Open the Verification Center to check them yourself.',
    verifyUrl: 'https://cloud.near.ai/verify',
  };
}
