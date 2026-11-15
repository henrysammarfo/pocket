// Request money links: ids, memos, input validation, and the pending, paid, refunded status machine.
import { describe, expect, it } from 'vitest';
import { cleanRequest, newRequestId, parseMemo, refundMemo, requestMemo, requestPath, requestStatus, validRequestId, MAX_REQUEST, type PayRequest } from '@/lib/shared/request';

const R: PayRequest = { id: 'abcdef123456', account: 'ama.p.testnet', amount: '25', token: 'pUSD', note: 'lunch', at: 1_000_000 };
const recv = (amount: string, extra: Record<string, unknown> = {}, at = 2_000_000, tx = 'PAY') => ({ kind: 'receive', tx, at, data: { token: 'pUSD', amount, from: 'bob.p.testnet', memo: requestMemo(R.id), ...extra } });
const send = (amount: string, extra: Record<string, unknown> = {}, at = 3_000_000, tx = 'REF') => ({ kind: 'send', tx, at, data: { token: 'pUSD', amount, to: 'bob.p.testnet', memo: refundMemo(R.id), ...extra } });

describe('ids and memos', () => {
  it('new ids are 12 lowercase letters or digits, and 1000 of them are unique', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newRequestId()));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(validRequestId(id)).toBe(true);
  });
  it.each(['', 'ABCDEF123456', 'abc', 'abcdef1234567', 'abcdef12345!', 'abcdef 12345', 12, null])('rejects id %j', (v) => expect(validRequestId(v)).toBe(false));
  it('memo round trips', () => { expect(parseMemo(requestMemo(R.id))).toEqual({ kind: 'request', id: R.id }); expect(parseMemo(refundMemo(R.id))).toEqual({ kind: 'refund', id: R.id }); });
  it.each(['pocket request ABCDEF123456', 'pocket pay abcdef123456', 'request abcdef123456', 'pocket request abcdef12345', null, 5, 'pocket request abcdef123456 extra'])('parseMemo ignores %j', (m) => expect(parseMemo(m)).toBeNull());
  it('path escapes the username', () => expect(requestPath('ama', R.id)).toBe('/pay/ama?r=abcdef123456'));
});

describe('cleanRequest', () => {
  it.each([['25', '25'], ['12.50', '12.5'], ['0.01', '0.01'], [String(MAX_REQUEST), String(MAX_REQUEST)], [7, '7'], [' 3 ', '3']])('accepts %j as %s', (a, want) => {
    const c = cleanRequest({ amount: a, token: 'pUSD' }); expect(c.ok && c.amount).toBe(want);
  });
  it.each(['', '0', '0.00', '-1', '1e3', '1.234', 'abc', '10000.01', '9999999', 'NaN', 'Infinity', '1,000', '0x10', null, {}, []])('refuses amount %j', (a) => expect(cleanRequest({ amount: a as unknown as string }).ok).toBe(false));
  it.each(['NEAR', 'TSLAon', 'usd', '', 5])('refuses token %j', (t) => expect(cleanRequest({ amount: '1', token: t }).ok).toBe(false));
  it('defaults to pUSD and allows USDC', () => { expect(cleanRequest({ amount: '1' })).toMatchObject({ ok: true, token: 'pUSD' }); expect(cleanRequest({ amount: '1', token: 'USDC' })).toMatchObject({ ok: true, token: 'USDC' }); });
  it('cleans control characters and spaces in the note, refuses long notes', () => {
    expect(cleanRequest({ amount: '1', note: '  rent\u0000\n  for\tMay ' })).toMatchObject({ note: 'rent for May' });
    expect(cleanRequest({ amount: '1', note: 'x'.repeat(81) }).ok).toBe(false);
    expect(cleanRequest({ amount: '1', note: 42 })).toMatchObject({ note: '' });
  });
  it('fuzz: 2000 random inputs never crash and every accepted amount is between 0.01 and the max', () => {
    let s = 7; const r = () => ((s = (s * 48271) % 2147483647) / 2147483647);
    for (let i = 0; i < 2000; i++) {
      const a = r() < 0.5 ? (r() * 20000 - 5000).toFixed(Math.floor(r() * 4)) : String.fromCharCode(...Array.from({ length: Math.floor(r() * 8) }, () => 32 + Math.floor(r() * 90)));
      const c = cleanRequest({ amount: a, token: r() < 0.5 ? 'pUSD' : 'USDC' });
      if (c.ok) { expect(Number(c.amount)).toBeGreaterThanOrEqual(0.01); expect(Number(c.amount)).toBeLessThanOrEqual(MAX_REQUEST); }
    }
  });
});

describe('requestStatus', () => {
  it('pending with no activity', () => expect(requestStatus(R, [])).toEqual({ status: 'pending' }));
  it('paid by an exact payment', () => expect(requestStatus(R, [recv('25')])).toMatchObject({ status: 'paid', paidTx: 'PAY', payer: 'bob.p.testnet', paidAmount: '25' }));
  it('paid by an overpayment', () => expect(requestStatus(R, [recv('30')]).status).toBe('paid'));
  it.each([
    ['an underpayment', recv('24.99')],
    ['the wrong token', recv('25', { token: 'USDC' })],
    ['the wrong memo', recv('25', { memo: requestMemo('zzzzzzzzzzzz') })],
    ['no memo', recv('25', { memo: null })],
    ['a refund memo', recv('25', { memo: refundMemo(R.id) })],
    ['a payment from before the request', recv('25', {}, R.at - 120_000)],
    ['a send instead of a receive', { ...recv('25'), kind: 'send' }],
    ['a broken amount', recv('lots')],
  ])('stays pending for %s', (_n, a) => expect(requestStatus(R, [a]).status).toBe('pending'));
  it('two partial payments do not add up to paid (each must cover the request)', () => expect(requestStatus(R, [recv('10', {}, 2e6, 'a'), recv('15', {}, 2.1e6, 'b')]).status).toBe('pending'));
  it('uses the first matching payment', () => expect(requestStatus(R, [recv('25', { from: 'late.testnet' }, 2.5e6, 'L'), recv('25', {}, 2e6, 'E')]).paidTx).toBe('E'));
  it('refunded after the requester sends it back to the payer', () => expect(requestStatus(R, [recv('25'), send('25')])).toMatchObject({ status: 'refunded', refundTx: 'REF', paidTx: 'PAY' }));
  it.each([
    ['to someone else', send('25', { to: 'eve.testnet' })],
    ['for less', send('20')],
    ['in another token', send('25', { token: 'USDC' })],
    ['with the request memo', send('25', { memo: requestMemo(R.id) })],
    ['before the payment', send('25', {}, 1_500_000)],
  ])('a refund %s does not count', (_n, s) => expect(requestStatus(R, [recv('25'), s]).status).toBe('paid'));
  it('a refund must cover an overpayment too', () => { expect(requestStatus(R, [recv('30'), send('25')]).status).toBe('paid'); expect(requestStatus(R, [recv('30'), send('30')]).status).toBe('refunded'); });
  it('noise from other requests and other activity is ignored (300 random histories)', () => {
    let s = 3; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 300; i++) {
      const noise = Array.from({ length: 10 }, (_, j) => ({ kind: r() < 0.5 ? 'receive' : 'send', tx: 'n' + j, at: 1e6 + j * 1000, data: { token: 'pUSD', amount: '25', from: 'bob.p.testnet', to: 'bob.p.testnet', memo: r() < 0.5 ? requestMemo('other0000000') : refundMemo('other0000000') } }));
      const paid = r() < 0.5;
      const st = requestStatus(R, paid ? [...noise, recv('25')] : noise);
      expect(st.status).toBe(paid ? 'paid' : 'pending');
    }
  });
});
