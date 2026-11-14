// `npm run verify:tee`: checks that the NEAR AI Cloud model Pocket can use (AI_PROVIDER=nearai) runs in
// a hardware TEE and that the attestation is fresh and bound to its signing key. No API key needed.
// Steps: ask for an attestation with our own random nonce, then check for the gateway and every model
// instance that (1) the quote is an Intel TDX v4 quote, (2) the quote's report_data carries our nonce,
// so it was made just now and not replayed, (3) report_data carries the model's signing address, and
// (4) that address is keccak256 of the signing public key, so responses signed by that key come from
// inside this enclave, and (5) the NVIDIA GPU evidence carries our nonce too. The Intel and NVIDIA
// certificate chains are checked by NEAR AI's verifier: https://docs.near.ai/cloud/verification
import crypto from 'node:crypto';
import { keccak_256 } from '@noble/hashes/sha3.js';

const MODELS = (process.env.TEE_MODELS || 'Qwen/Qwen3.6-35B-A3B-FP8,Qwen/Qwen3-VL-30B-A3B-Instruct,openai/whisper-large-v3').split(',');
let fail = 0;
for (const MODEL of MODELS) {
console.log(`\n${MODEL}`);
const BASE = process.env.NEARAI_BASE_URL || 'https://cloud-api.near.ai/v1';
const nonce = crypto.randomBytes(32).toString('hex');
const r = await fetch(`${BASE}/attestation/report?model=${encodeURIComponent(MODEL)}&nonce=${nonce}&signing_algo=ecdsa`, { signal: AbortSignal.timeout(30000) });
if (!r.ok) { console.log(`FAIL attestation request: HTTP ${r.status}`); fail++; continue; }
const rep = await r.json();
const check = (ok, what) => { console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`); if (!ok) fail++; };
// TDX quote v4: 48 byte header, TD report body after it; report_data is the last 64 bytes of the body.
const quote = (hex) => { const q = Buffer.from(hex, 'hex'); return { version: q.readUInt16LE(0), tee: q.readUInt32LE(4), reportData: q.subarray(568, 632).toString('hex') }; };

const g = quote(rep.gateway_attestation.intel_quote);
check(g.version === 4 && g.tee === 0x81, `gateway: Intel TDX quote v${g.version}`);
check(g.reportData.endsWith(nonce) && rep.gateway_attestation.report_data === g.reportData, 'gateway: quote is fresh, bound to our nonce');
const models = rep.model_attestations || [];
check(models.length > 0, `${MODEL}: ${models.length} attested instance(s)`);
for (const [i, m] of models.entries()) {
  const q = quote(m.intel_quote);
  const addr = m.signing_address.replace(/^0x/, '').toLowerCase();
  const fromKey = Buffer.from(keccak_256(Buffer.from(m.signing_public_key.replace(/^0x/, '').replace(/^04/, ''), 'hex'))).subarray(12).toString('hex');
  let gpuNonce = null; try { gpuNonce = JSON.parse(m.nvidia_payload).nonce; } catch { /* missing */ }
  check(q.version === 4 && q.tee === 0x81, `instance ${i + 1}: Intel TDX quote v${q.version}`);
  check(q.reportData.slice(64) === nonce, `instance ${i + 1}: quote is fresh, bound to our nonce`);
  check(q.reportData.slice(0, 40) === addr, `instance ${i + 1}: quote binds signing address 0x${addr}`);
  check(fromKey === addr, `instance ${i + 1}: signing address is keccak256 of the enclave's public key`);
  check(gpuNonce === nonce, `instance ${i + 1}: NVIDIA GPU evidence bound to our nonce`);
}
}
console.log(fail ? `${fail} FAIL` : `ALL PASS: ${MODELS.join(', ')} on NEAR AI Cloud run in attested TEEs`);
process.exit(fail ? 1 : 0);
