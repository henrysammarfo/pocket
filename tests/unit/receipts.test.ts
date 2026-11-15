// Receipts CSV export: columns, signs, quoting, formula injection, dedupe, and a round trip property.
import { describe, expect, it } from 'vitest';
import { CSV_COLUMNS, csvCell, csvFileName, parseCsv, receiptRow, receiptsCsv, type ReceiptItem } from '@/lib/shared/csv';

const O = 'https://pocket.test';
const at = Date.UTC(2026, 10, 15, 9, 30);
const item = (kind: string, data: Record<string, unknown>, tx = 'TX' + kind, t = at): ReceiptItem => ({ kind, tx, data, at: t });
let seed = 42; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const ALPH = 'abc XYZ,"\n\r=+-@\t;é€💸\'';
const rstr = (n = 12) => Array.from({ length: Math.floor(rnd() * n) }, () => ALPH[Math.floor(rnd() * ALPH.length)]).join('');

describe('receipt rows', () => {
  it('has a header with every column, in order', () => expect(parseCsv(receiptsCsv([], O))[0]).toEqual([...CSV_COLUMNS]));
  it.each([
    ['send', { token: 'pUSD', amount: '25', to: 'bob.p.testnet' }, { asset: 'pUSD', amount: '-25', counterparty: 'bob.p.testnet' }],
    ['receive', { token: 'USDC', amount: '3.5', from: 'ama.p.testnet' }, { asset: 'USDC', amount: '3.5', counterparty: 'ama.p.testnet' }],
    ['buy', { token: 'TSLAon', qty: '0.05', usd: 20, maker: 'market.p.testnet' }, { asset: 'TSLAon', amount: '0.05', usd: '-20', counterparty: 'market.p.testnet' }],
    ['sell', { token: 'NVDAon', qty: '1', usd: 180.25, maker: 'market.p.testnet' }, { asset: 'NVDAon', amount: '-1', usd: '180.25' }],
    ['faucet', { amount: 1000, from: 'faucet.p.testnet' }, { asset: 'pUSD', amount: '1000', counterparty: 'faucet.p.testnet' }],
    ['signup', { near: '0.1' }, { asset: 'NEAR', amount: '0.1', counterparty: '' }],
    ['mystery', { token: 'X', amount: '2' }, { asset: 'X', amount: '2' }],
  ])('maps a %s', (kind, data, want) => {
    const r = receiptRow(item(kind, data), O);
    expect(r).toMatchObject({ type: kind, ...want, tx: 'TX' + kind, receipt_url: `${O}/r/TX${kind}`, explorer_url: `https://testnet.nearblocks.io/txns/TX${kind}` });
    expect(r.date_utc).toBe('2026-11-15T09:30:00.000Z');
  });
  it('a zero send is not written as minus zero', () => expect(receiptRow(item('send', { token: 'pUSD', amount: '0', to: 'x.testnet' }), O).amount).toBe('0'));
  it('a negative input amount on a send does not become a double minus', () => expect(receiptRow(item('send', { token: 'pUSD', amount: '-2', to: 'x.testnet' }), O).amount).toBe('2'));
  it('keeps the memo', () => expect(receiptRow(item('send', { token: 'pUSD', amount: '1', to: 'x.testnet', memo: 'pocket request abcdefabcdef' }), O).memo).toBe('pocket request abcdefabcdef'));
});

describe('csv cells', () => {
  it.each([
    [null, ''], [undefined, ''], ['plain', 'plain'], [12.5, '12.5'], [-3, '-3'], ['-3', '-3'], ['-3.25', '-3.25'], [NaN, ''], [Infinity, ''],
    ['a,b', '"a,b"'], ['say "hi"', '"say ""hi"""'], ['two\nlines', '"two\nlines"'], ['cr\rhere', '"cr\rhere"'],
    ['=1+1', "'=1+1"], ['+44 20', "'+44 20"], ['-cmd', "'-cmd"], ['@SUM(A1)', "'@SUM(A1)"], ['\tx', "'\tx"], ['\rx', '"\'\rx"'],
    ['=HYPERLINK("http://evil","x")', '"\'=HYPERLINK(""http://evil"",""x"")"'], ['a=b', 'a=b'],
  ])('%j becomes %j', (v, want) => expect(csvCell(v)).toBe(want));
  it('no exported text cell ever starts with a formula character (500 random memos)', () => {
    for (let i = 0; i < 500; i++) {
      const memo = rstr(20);
      const rows = parseCsv(receiptsCsv([item('receive', { token: 'pUSD', amount: '1', from: 'x.testnet', memo })], O));
      const cell = rows[1][CSV_COLUMNS.indexOf('memo')];
      expect(/^[=+\-@\t\r]/.test(cell)).toBe(false);
      expect(cell === memo || cell === "'" + memo).toBe(true);
      if (/^[=+\-@\t\r]/.test(memo)) expect(cell).toBe("'" + memo);
    }
  });
});

describe('whole export', () => {
  it('sorts newest first and drops duplicates of the same kind and tx', () => {
    const csv = receiptsCsv([item('send', { amount: 1 }, 'A', at), item('send', { amount: 1 }, 'B', at + 1000), item('send', { amount: 1 }, 'A', at), item('receive', { amount: 1 }, 'A', at)], O);
    const rows = parseCsv(csv).slice(1);
    expect(rows.map((r) => r[CSV_COLUMNS.indexOf('tx')])).toEqual(['B', 'A', 'A']);
    expect(rows.map((r) => r[1])).toEqual(['send', 'send', 'receive']);
  });
  it('uses CRLF line ends and ends with one', () => { const c = receiptsCsv([item('send', { amount: 1 })], O); expect(c.endsWith('\r\n')).toBe(true); expect(c.split('\r\n').length).toBe(3); });
  it('round trip: 300 random histories parse back to the same row count and columns', () => {
    for (let n = 0; n < 300; n++) {
      const items = Array.from({ length: Math.floor(rnd() * 8) }, (_, i) => item(['send', 'receive', 'buy', 'sell', 'faucet'][Math.floor(rnd() * 5)], { token: rstr(6), amount: String(Math.floor(rnd() * 1e6) / 100), to: rstr(10), from: rstr(10), memo: rstr(30), qty: '1', usd: 2 }, 'T' + n + '_' + i, at + i));
      const rows = parseCsv(receiptsCsv(items, O));
      expect(rows.length).toBe(items.length + 1);
      for (const r of rows) expect(r.length).toBe(CSV_COLUMNS.length);
    }
  });
  it('file name has the account label and the date', () => expect(csvFileName('ama.pocket-7e2413.testnet', new Date(at))).toBe('pocket-receipts-ama-2026-11-15.csv'));
});
