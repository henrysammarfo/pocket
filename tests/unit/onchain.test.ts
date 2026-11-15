// On chain limits: relayer policy for wallet calls (second layer), the rule comparison the app uses
// (same as the contract's is_raise), and the hand written borsh encoder for the signup transaction.
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { actionCreators, createTransaction, encodeTransaction } from '@near-js/transactions';
import { PublicKey } from '@near-js/crypto';
import bs58 from 'bs58';
import { walletPolicy, delegatePolicy, type DelegateJson } from '@/lib/shared/policy';
import { DEVICE_ALLOWANCE, DEVICE_METHODS, defaultLimits, isRaise, withDaily, SEND_GAS, TRADE_GAS } from '@/lib/shared/wallet';
import { PUSD, ROOT, STOCK_TOKENS } from '@/lib/shared/deployment';
import { G, signTx } from '@/lib/server/globaltx';
import { newKey, keyFromString } from '@/lib/shared/nep413';

const me = `ama.${ROOT}`;
const pk = newKey().publicKey;
const d = (actions: unknown[], over: Partial<DelegateJson> = {}): DelegateJson => ({ senderId: me, receiverId: me, nonce: '5', maxBlockHeight: '100', publicKey: pk, actions: actions as DelegateJson['actions'], signature: 'x', ...over });
const send = (method: string, args: object, extra: object = {}) => ({ type: 'functionCall', method, args, gas: SEND_GAS.toString(), deposit: '0', ...extra });

describe('relayer policy for wallet calls (R8, R9)', () => {
  it('counts pUSD and USDC sends in dollars, NEAR and stock sends as zero', () => {
    expect(walletPolicy(d([send('send_token', { token_id: PUSD.assetId, receiver_id: 'bob.testnet', amount: '25000000' })])).usd).toBe(25);
    expect(walletPolicy(d([send('send_usdc', { receiver_id: 'bob.testnet', amount: '1500000' })])).usd).toBe(1.5);
    expect(walletPolicy(d([send('send_near', { receiver_id: 'bob.testnet', amount: '1' })])).usd).toBe(0);
    expect(walletPolicy(d([send('send_token', { token_id: STOCK_TOKENS[0].assetId, receiver_id: 'bob.testnet', amount: '1' })])).usd).toBe(0);
    expect(delegatePolicy(d([send('send_token', { token_id: PUSD.assetId, receiver_id: 'bob.testnet', amount: '2000000' })]))).toBe(2);
  });
  it.each([
    ['a deposit', [send('send_usdc', { receiver_id: 'bob.testnet', amount: '1' }, { deposit: '1' })]],
    ['an owner key method it does not know', [send('upgrade', {})]],
    ['two actions', [send('send_near', { receiver_id: 'bob.testnet', amount: '1' }), send('send_near', { receiver_id: 'bob.testnet', amount: '1' })]],
    ['too much gas', [send('trade', { pay_token: PUSD.assetId, pay_amount: '1', msg: '{}' }, { gas: (TRADE_GAS + 1n).toString() })]],
    ['a zero amount', [send('send_usdc', { receiver_id: 'bob.testnet', amount: '0' })]],
    ['a send to itself', [send('send_usdc', { receiver_id: me, amount: '1' })]],
    ['an unknown token', [send('send_token', { token_id: 'nep141:evil.testnet', receiver_id: 'bob.testnet', amount: '1' })]],
    ['a bad receiver', [send('send_near', { receiver_id: 'Not An Account', amount: '1' })]],
    ['a long memo', [send('send_usdc', { receiver_id: 'bob.testnet', amount: '1', memo: 'x'.repeat(300) })]],
    ['a callback', [send('on_sent', { key: 'usd', hour: 1, amount: '1' })]],
    ['a device key with extra methods', [{ type: 'addKey', publicKey: newKey().publicKey, methods: [...DEVICE_METHODS, 'propose_limits'], allowance: DEVICE_ALLOWANCE }]],
    ['a device key with unlimited gas allowance', [{ type: 'addKey', publicKey: newKey().publicKey, methods: [...DEVICE_METHODS], allowance: '0' }]],
  ])('refuses %s', (_n, actions) => expect(() => walletPolicy(d(actions))).toThrow());
  it('refuses wallet calls for a service account or another sender', () => {
    expect(() => delegatePolicy(d([send('send_near', { receiver_id: 'bob.testnet', amount: '1' })], { senderId: `relayer.${ROOT}`, receiverId: `relayer.${ROOT}` }))).toThrow();
    expect(() => delegatePolicy(d([send('send_near', { receiver_id: 'bob.testnet', amount: '1' })], { senderId: `market.${ROOT}`, receiverId: `market.${ROOT}` }))).toThrow();
  });
  it('allows a correct restore key', () => expect(walletPolicy(d([{ type: 'addKey', publicKey: newKey().publicKey, methods: [...DEVICE_METHODS], allowance: DEVICE_ALLOWANCE }])).method).toBe('add_device_key'));
});

describe('rule comparison matches the contract', () => {
  const base = defaultLimits();
  it('a higher daily cap is a raise, a lower one is not', () => {
    expect(isRaise(withDaily(base, 500), base)).toBe(true);
    expect(isRaise(withDaily(base, 50), base)).toBe(false);
    expect(BigInt(withDaily(base, 50).usd_per_send)).toBe(50_000_000n);
  });
  it('a shorter raise delay, a new token cap, or dropping a block is a raise', () => {
    expect(isRaise({ ...base, raise_delay_sec: base.raise_delay_sec - 1 }, base)).toBe(true);
    expect(isRaise({ ...base, token_caps: [...base.token_caps, { token_id: 'nep141:x', per_send: '1', per_day: '1' }] }, base)).toBe(true);
    expect(isRaise(base, { ...base, blocked: ['eve.testnet'] })).toBe(true);
    expect(isRaise({ ...base, allow_only: ['bob.testnet'] }, base)).toBe(false);
    expect(isRaise(base, { ...base, allow_only: ['bob.testnet'] })).toBe(true);
  });
  it('defaults: $100 a send, $200 a day, 24 hour raise delay, caps on every stock token', () => {
    expect(base.usd_per_send).toBe('100000000');
    expect(base.usd_per_day).toBe('200000000');
    expect(base.raise_delay_sec).toBe(86400);
    expect(base.token_caps.length).toBe(STOCK_TOKENS.length);
  });
});

describe('signup transaction encoder', () => {
  it('encodes classic actions byte for byte like @near-js/transactions', () => {
    const k = keyFromString(newKey().secretKey);
    const dev = newKey().publicKey;
    const blockHash = bs58.encode(new Uint8Array(32).fill(7));
    const mine = signTx({ signerId: ROOT, publicKey: k.publicKey, seed: k.seed, nonce: 9n, receiverId: me, blockHash, actions: [G.createAccount(), G.transfer(10n ** 23n), G.fullKey(pk), G.fnKey(dev, me, DEVICE_METHODS, BigInt(DEVICE_ALLOWANCE)), G.call('new', { a: 1 }, 30n * 10n ** 12n)] });
    const ref = encodeTransaction(createTransaction(ROOT, PublicKey.fromString(k.publicKey), me, 9n, [
      actionCreators.createAccount(), actionCreators.transfer(10n ** 23n), actionCreators.addKey(PublicKey.fromString(pk), actionCreators.fullAccessKey()),
      actionCreators.addKey(PublicKey.fromString(dev), actionCreators.functionCallAccessKey(me, [...DEVICE_METHODS], BigInt(DEVICE_ALLOWANCE))),
      actionCreators.functionCall('new', Buffer.from(JSON.stringify({ a: 1 })), 30n * 10n ** 12n, 0n),
    ], bs58.decode(blockHash)));
    expect(Buffer.from(mine.bytes).equals(Buffer.from(ref))).toBe(true);
  });
  it('encodes UseGlobalContract as action 10 with the code hash variant', () => {
    const k = keyFromString(newKey().secretKey);
    const hash = bs58.encode(new Uint8Array(32).fill(3));
    const t = signTx({ signerId: ROOT, publicKey: k.publicKey, seed: k.seed, nonce: 1n, receiverId: me, blockHash: hash, actions: [G.globalCode(hash)] });
    const b = Buffer.from(t.bytes);
    expect([...b.subarray(b.length - 34)]).toEqual([10, 0, ...new Array(32).fill(3)]);
  });
});
