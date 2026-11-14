import 'server-only';
// Live TEE attestation for the NEAR AI Cloud models Pocket uses (chat, photos, voice).
// Same checks as `npm run verify:tee`, run on demand from Settings > Private AI. For each model:
//  1. ask NEAR AI Cloud for an attestation with our own fresh random nonce (32 bytes, never reused)
//  2. the gateway quote is an Intel TDX v4 quote and its report_data carries our nonce
//  3. every model instance's quote is an Intel TDX v4 quote carrying our nonce (fresh, not replayed)
//  4. the quote binds the instance's signing address, and that address is keccak256 of the enclave's
//     public key, so replies signed by that key come from inside this enclave
//  5. the NVIDIA GPU evidence carries our nonce too
// The Intel and NVIDIA certificate chains are checked by NEAR AI's verifier (https://cloud.near.ai/verify);
// we say so in the result instead of claiming it. No API key is needed and nothing about the user is sent.
import crypto from 'node:crypto';
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
export function readQuote(hex: string) {
  const q = Buffer.from(String(hex || ''), 'hex');
  if (q.length < 632) return { version: 0, tee: 0, reportData: '' };
  return { version: q.readUInt16LE(0), tee: q.readUInt32LE(4), reportData: q.subarray(568, 632).toString('hex') };
}
export const isTdx = (q: { version: number; tee: number }) => q.version === 4 && q.tee === 0x81;
export function addressOfKey(pub: string) {
  return Buffer.from(keccak_256(Buffer.from(String(pub).replace(/^0x/, '').replace(/^04/, ''), 'hex'))).subarray(12).toString('hex');
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

async function one(m: (typeof ATTEST_MODELS)[number]): Promise<ModelReport> {
  const t0 = Date.now();
  const nonce = crypto.randomBytes(32).toString('hex');
  try {
    const r = await fetch(`${BASE}/attestation/report?model=${encodeURIComponent(m.model)}&nonce=${nonce}&signing_algo=ecdsa`, { signal: AbortSignal.timeout(25000), cache: 'no-store' });
    if (!r.ok) throw new Error(`NEAR AI Cloud answered HTTP ${r.status}`);
    const g = grade(await r.json(), nonce);
    return { ...m, ...g, ok: g.checks.every((c) => c.ok), ms: Date.now() - t0 };
  } catch (e) {
    return { ...m, ok: false, instances: 0, checks: [], error: e instanceof Error ? e.message.slice(0, 160) : 'Check failed', ms: Date.now() - t0 };
  }
}

export async function attestAll(): Promise<AttestReport> {
  const models = await Promise.all(ATTEST_MODELS.map(one));
  return {
    ok: models.every((m) => m.ok), provider: 'NEAR AI Cloud', checkedAt: new Date().toISOString(), models,
    notChecked: 'Intel and NVIDIA certificate chains are verified by NEAR AI. Open the Verification Center to check them yourself.',
    verifyUrl: 'https://cloud.near.ai/verify',
  };
}
