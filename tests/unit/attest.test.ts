// The Verified screen grades NEAR AI Cloud attestation evidence. These tests build synthetic Intel TDX
// quotes and check that fresh, correctly bound evidence passes and replayed or unbound evidence fails.
import { describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import { secp256k1 } from '@noble/curves/secp256k1.js';
vi.mock('server-only', () => ({}));
import { grade, addressOfKey } from '@/lib/server/attest';

const quote = (reportData: string, version = 4, tee = 0x81) => {
  const q = Buffer.alloc(632 + 64); q.writeUInt16LE(version, 0); q.writeUInt32LE(tee, 4); Buffer.from(reportData, 'hex').copy(q, 568); return q.toString('hex');
};
function evidence(nonce: string, opts: { gpuNonce?: string; quoteNonce?: string; tee?: number } = {}) {
  const pub = Buffer.from(secp256k1.getPublicKey(secp256k1.utils.randomSecretKey(), false)).toString('hex');
  const addr = addressOfKey(pub);
  const rd = addr + '00'.repeat(12) + (opts.quoteNonce ?? nonce);
  const gw = '11'.repeat(32) + nonce;
  return { gateway_attestation: { intel_quote: quote(gw), report_data: gw }, model_attestations: [{ intel_quote: quote(rd, 4, opts.tee ?? 0x81), signing_address: '0x' + addr, signing_public_key: pub, nvidia_payload: JSON.stringify({ nonce: opts.gpuNonce ?? nonce }) }] };
}

describe('attestation grading', () => {
  const nonce = crypto.randomBytes(32).toString('hex');
  it('passes fresh evidence bound to our nonce and the enclave key', () => {
    const g = grade(evidence(nonce), nonce);
    expect(g.instances).toBe(1);
    expect(g.checks.map((c) => [c.id, c.ok])).toEqual([['gateway', true], ['tdx', true], ['fresh', true], ['key', true], ['gpu', true]]);
  });
  it('fails replayed evidence made for another nonce', () => {
    const old = crypto.randomBytes(32).toString('hex');
    const g = grade(evidence(nonce, { quoteNonce: old, gpuNonce: old }), nonce);
    expect(g.checks.find((c) => c.id === 'fresh')!.ok).toBe(false);
    expect(g.checks.find((c) => c.id === 'gpu')!.ok).toBe(false);
  });
  it('fails a quote that is not Intel TDX, and empty evidence', () => {
    expect(grade(evidence(nonce, { tee: 0 }), nonce).checks.find((c) => c.id === 'tdx')!.ok).toBe(false);
    expect(grade({}, nonce).checks.every((c) => !c.ok)).toBe(true);
  });
  it('fails when the signing address is not the hash of the public key', () => {
    const e = evidence(nonce); e.model_attestations[0].signing_public_key = Buffer.from(secp256k1.getPublicKey(secp256k1.utils.randomSecretKey(), false)).toString('hex');
    expect(grade(e, nonce).checks.find((c) => c.id === 'key')!.ok).toBe(false);
  });
});
