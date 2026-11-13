import { describe, expect, it } from 'vitest';
import { newKey, keyFromString, signNep413, verifyNep413, randomNonce, b64decode } from '@/lib/shared/nep413';
import { buildPayload, parseMessage } from '@/lib/shared/intents';
import { checkPlan, parseCommand } from '@/lib/shared/plan';
import { detect } from '@/lib/shared/address';
import { toUnits, fromUnits } from '@/lib/shared/units';

describe('nep413', () => {
  it('signs and verifies, and rejects a changed message', () => {
    const k = newKey();
    const { payload } = buildPayload('a.testnet', 'verifier.testnet', [{ intent: 'transfer', receiver_id: 'b.testnet', tokens: { 'nep141:p.testnet': '1' } }]);
    const s = signNep413(payload, keyFromString(k.secretKey).seed);
    expect(verifyNep413(s)).toBe(true);
    expect(verifyNep413({ ...s, payload: { ...s.payload, message: s.payload.message.replace('"1"', '"2"') } })).toBe(false);
    expect(parseMessage(s.payload.message)?.signer_id).toBe('a.testnet');
  });
  it('nonces are 32 bytes and never start with the versioned magic', () => {
    for (let i = 0; i < 200; i++) { const n = b64decode(randomNonce()); expect(n.length).toBe(32); expect(n[0] === 0x56 && n[1] === 0x28).toBe(false); }
  });
});
describe('units', () => {
  it('round trips without floats', () => { expect(toUnits('12.345678', 6).toString()).toBe('12345678'); expect(fromUnits(12345678n, 6)).toBe('12.345678'); });
});
describe('address detection', () => {
  it('blocks mainnet and never guesses 0x', () => {
    expect(detect('ama.near').kind).toBe('mainnet');
    expect(detect('0x71c7656ec7ab88b098defb751b7401b5f6d8976f').kind).toBe('evm-or-near');
    expect(detect('kofi.testnet').kind).toBe('near-named');
    expect(detect('@kofi').kind).toBe('username');
    expect(detect('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq').kind).toBe('unsupported');
  });
});
describe('plan parser and rules', () => {
  it('parses a two step command', () => {
    expect(parseCommand('Send my mum in Ghana 50 dollars and put 25 in Tesla')).toEqual([
      expect.objectContaining({ type: 'send', amount: 50 }), expect.objectContaining({ type: 'buy', ticker: 'TSLA', usd: 25 }),
    ]);
  });
  const ctx = { dollars: 300, pusd: 300, usdc: 0, near: 0.05, holdings: {}, keep: 200, limit: 200, usedToday: 0, prices: { TSLA: 400 } };
  it('blocks a plan that breaks the keep rule', () => {
    const c = checkPlan({ id: 'x', summary: '', steps: [{ type: 'send', to: 'mum', toLabel: 'Mum', amount: 150, asset: 'auto' }] }, ctx);
    expect(c.ok).toBe(false);
  });
  it('allows a plan inside the rules', () => {
    expect(checkPlan({ id: 'x', summary: '', steps: [{ type: 'send', to: 'mum', toLabel: 'Mum', amount: 50, asset: 'auto' }, { type: 'buy', ticker: 'TSLA', usd: 25 }] }, ctx).ok).toBe(true);
  });
  it('blocks a send over the daily limit', () => {
    expect(checkPlan({ id: 'x', summary: '', steps: [{ type: 'send', to: 'mum', toLabel: 'Mum', amount: 60, asset: 'auto' }] }, { ...ctx, keep: 0, usedToday: 150 }).ok).toBe(false);
  });
});
