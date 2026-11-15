// Wallet v2: owner messages signed by the recovery key, Pocket signed prices, the shared block list,
// and the receiver check's account age rule. The contract side of each is in contracts/wallet/src/tests.rs.
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { ed25519 } from '@noble/curves/ed25519.js';
import { walletPolicy, type DelegateJson } from '@/lib/shared/policy';
import { BLOCKLIST, DEVICE_METHODS, OWNER_TAG, PRICE_TAG, SEND_GAS, defaultLimits, microUsdOf, ownerPayload, signTagged, verifyTagged } from '@/lib/shared/wallet';
import { checkReceiver, type ReceiverFacts } from '@/lib/shared/receiver';
import { PUSD, ROOT, STOCK_TOKENS } from '@/lib/shared/deployment';
import { newKey } from '@/lib/shared/nep413';

const me = `ama.${ROOT}`;
const pk = newKey().publicKey;
const d = (actions: unknown[]): DelegateJson => ({ senderId: me, receiverId: me, nonce: '5', maxBlockHeight: '100', publicKey: pk, actions: actions as DelegateJson['actions'], signature: 'x' });
const call = (method: string, args: object) => ({ type: 'functionCall', method, args, gas: SEND_GAS.toString(), deposit: '0' });
const seed = new Uint8Array(32).fill(5);
const pub = ed25519.getPublicKey(seed);
const price = (token: string, micro: string, decimals: number) => {
  const payload = JSON.stringify({ v: 1, token, micro_usd: micro, decimals, expires_ms: Date.now() + 60_000 });
  return { payload, signature: signTagged(PRICE_TAG, payload, seed) };
};

describe('tagged signatures', () => {
  it('signs and verifies an owner message', () => {
    const p = ownerPayload(me, 1, 'cancel_pending');
    expect(verifyTagged(OWNER_TAG, p, signTagged(OWNER_TAG, p, seed), pub)).toBe(true);
  });
  it('matches the vector the Rust contract test checks', () => {
    const p = ownerPayload('alice.pocket.testnet', 1, { set_limits: { limits: { x: 1 } } } as never);
    expect(signTagged(OWNER_TAG, p, new Uint8Array(32).fill(6))).toBe('071271910161098ae42ab24f6108c16e3541d970bb2463b8335269de1c7c41c2b97206e99046e8ad2103edd52d49ca7f98a01dc890eb1957517aaf95712dde06');
  });
  it('a price signature is not an owner signature (domain tags differ)', () => {
    const p = ownerPayload(me, 1, 'cancel_pending');
    expect(verifyTagged(OWNER_TAG, p, signTagged(PRICE_TAG, p, seed), pub)).toBe(false);
  });
  it('a changed payload fails', () => {
    const p = ownerPayload(me, 1, 'cancel_pending');
    expect(verifyTagged(OWNER_TAG, ownerPayload(me, 2, 'cancel_pending'), signTagged(OWNER_TAG, p, seed), pub)).toBe(false);
  });
  it.each(['', 'zz', '00'.repeat(63), 'g'.repeat(128)])('bad hex %j fails closed', (s) => expect(verifyTagged(OWNER_TAG, 'x', s, pub)).toBe(false));
  it('the owner nonce goes into the signed bytes', () => expect(JSON.parse(ownerPayload(me, 7, 'cancel_pending'))).toEqual({ account: me, nonce: 7, action: 'cancel_pending' }));
});

describe('micro dollars from a signed price', () => {
  it('1 NEAR at $3', () => expect(microUsdOf(10n ** 24n, { v: 1, token: 'near', micro_usd: '3000000', decimals: 24, expires_ms: 0 })).toBe(3_000_000n));
  it('half a stock at $400', () => expect(microUsdOf(5n * 10n ** 17n, { v: 1, token: 'x', micro_usd: '400000000', decimals: 18, expires_ms: 0 })).toBe(200_000_000n));
  it('rounds down', () => expect(microUsdOf(1n, { v: 1, token: 'near', micro_usd: '3000000', decimals: 24, expires_ms: 0 })).toBe(0n));
});

describe('relayer policy for v2 calls', () => {
  it('counts a priced NEAR send in dollars', () => expect(walletPolicy(d([call('send_near', { receiver_id: 'bob.testnet', amount: (2n * 10n ** 24n).toString(), price: price('near', '3000000', 24) })])).usd).toBe(6));
  it('counts a priced stock send in dollars', () => {
    const t = STOCK_TOKENS[0];
    expect(walletPolicy(d([call('send_token', { token_id: t.assetId, receiver_id: 'bob.testnet', amount: (10n ** BigInt(t.decimals)).toString(), price: price(t.assetId, '250000000', t.decimals) })])).usd).toBe(250);
  });
  it('pUSD ignores any price and counts face value', () => expect(walletPolicy(d([call('send_token', { token_id: PUSD.assetId, receiver_id: 'bob.testnet', amount: '5000000', price: price(PUSD.assetId, '1', 6) })])).usd).toBe(5));
  it.each([
    ['a price for another token', { payload: JSON.stringify({ v: 1, token: 'other', micro_usd: '1', decimals: 24, expires_ms: 1 }), signature: 'a'.repeat(128) }],
    ['a short signature', { payload: '{}', signature: 'ab' }],
    ['a payload that is not JSON', { payload: 'nope', signature: 'a'.repeat(128) }],
    ['a huge payload', { payload: 'x'.repeat(600), signature: 'a'.repeat(128) }],
    ['silly decimals', { payload: JSON.stringify({ v: 1, token: 'near', micro_usd: '1', decimals: 99, expires_ms: 1 }), signature: 'a'.repeat(128) }],
    ['version 2', { payload: JSON.stringify({ v: 2, token: 'near', micro_usd: '1', decimals: 24, expires_ms: 1 }), signature: 'a'.repeat(128) }],
  ])('refuses %s', (_n, p) => expect(() => walletPolicy(d([call('send_near', { receiver_id: 'bob.testnet', amount: '1', price: p })]))).toThrow());
  it('passes a well formed owner message', () => expect(walletPolicy(d([call('owner_action', { payload: '{}', public_key: pk, signature: 'a'.repeat(128) })])).method).toBe('owner_action'));
  it.each([
    ['no signature', { payload: '{}', public_key: pk }],
    ['a base64 signature', { payload: '{}', public_key: pk, signature: 'A'.repeat(88) }],
    ['a bad key', { payload: '{}', public_key: 'ed25519:xyz', signature: 'a'.repeat(128) }],
    ['a payload over 8 KB', { payload: 'x'.repeat(8193), public_key: pk, signature: 'a'.repeat(128) }],
  ])('refuses an owner message with %s', (_n, a) => expect(() => walletPolicy(d([call('owner_action', a)]))).toThrow());
  it('the phone key may call owner_action (the contract checks the recovery signature)', () => expect(DEVICE_METHODS).toContain('owner_action'));
});

describe('shared block list', () => {
  it('every entry has a reason and evidence', () => BLOCKLIST.forEach((b) => { expect(b.reason.length).toBeGreaterThan(10); expect(b.evidence).toMatch(/^(https:\/\/|docs\/)/); }));
  it('new wallets start with it on chain', () => expect(defaultLimits().blocked).toEqual(BLOCKLIST.map((b) => b.account)));
  it('fits the contract list size', () => expect(BLOCKLIST.length).toBeLessThanOrEqual(64));
});

const f = (to: string, x: Partial<ReceiverFacts> = {}): ReceiverFacts => ({ from: me, to, root: ROOT, services: [], exists: true, shared: BLOCKLIST, ...x });
describe('receiver check: shared list and account age', () => {
  it.each(BLOCKLIST.filter((b) => b.account.endsWith('.testnet') || /^(0x)?0+$/.test(b.account)).map((b) => b.account))('blocks %s with evidence', (to) => {
    const c = checkReceiver(f(to, { exists: false }));
    expect(c.verdict).toBe('block');
    expect(c.reasons[0].code).toBe('shared_block');
    expect(c.reasons[0].text).toContain('Evidence');
  });
  it('a 2 hour old account warns', () => expect(checkReceiver(f('fresh.testnet', { createdMs: 1_000_000_000_000 - 7_200_000, nowMs: 1_000_000_000_000 })).reasons.map((r) => r.code)).toContain('new_account'));
  it('a 3 day old account does not', () => expect(checkReceiver(f('old.testnet', { createdMs: 1_000_000_000_000 - 3 * 86_400_000, nowMs: 1_000_000_000_000 })).reasons.map((r) => r.code)).not.toContain('new_account'));
  it('unknown age never warns or blocks', () => expect(checkReceiver(f('x1.testnet', { createdMs: null })).reasons.map((r) => r.code)).not.toContain('new_account'));
});
