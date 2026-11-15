// SPDX-License-Identifier: MIT
// Receipts as CSV. One row per activity item, newest first, RFC 4180 quoting, CRLF line ends.
// Text cells that a spreadsheet would run as a formula (starting with = + - @ tab or CR) get a
// leading apostrophe, so a memo like "=HYPERLINK(...)" from a stranger cannot run in Excel or Sheets.
export type ReceiptItem = { kind: string; tx: string; data: Record<string, unknown>; at: number };
export const CSV_COLUMNS = ['date_utc', 'type', 'asset', 'amount', 'usd', 'counterparty', 'memo', 'tx', 'receipt_url', 'explorer_url'] as const;
type Row = Record<(typeof CSV_COLUMNS)[number], string | number | null>;

const NUM = /^-?\d+(\.\d+)?$/;
export function csvCell(v: unknown): string {
  if (v == null) return '';
  let s = typeof v === 'number' ? (Number.isFinite(v) ? String(v) : '') : String(v);
  if (typeof v !== 'number' && !NUM.test(s) && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
const str = (v: unknown) => (v == null ? '' : String(v));
const neg = (v: unknown) => { const s = str(v); return !s || s === '0' ? s : s.startsWith('-') ? s.slice(1) : '-' + s; };

export function receiptRow(a: ReceiptItem, origin: string, explorer = 'https://testnet.nearblocks.io/txns/'): Row {
  const d = a.data || {};
  const base = { date_utc: new Date(a.at).toISOString(), type: a.kind, tx: a.tx, receipt_url: `${origin}/r/${a.tx}`, explorer_url: explorer + a.tx, memo: str(d.memo) || null, usd: null as string | null };
  switch (a.kind) {
    case 'send': return { ...base, asset: str(d.token), amount: neg(d.amount), counterparty: str(d.to) };
    case 'receive': return { ...base, asset: str(d.token), amount: str(d.amount), counterparty: str(d.from) };
    case 'buy': return { ...base, asset: str(d.token), amount: str(d.qty), usd: neg(d.usd), counterparty: str(d.maker) };
    case 'sell': return { ...base, asset: str(d.token), amount: neg(d.qty), usd: str(d.usd), counterparty: str(d.maker) };
    case 'faucet': return { ...base, asset: str(d.token || 'pUSD'), amount: str(d.amount), counterparty: str(d.from) };
    case 'signup': return { ...base, asset: 'NEAR', amount: str(d.near), counterparty: '' };
    default: return { ...base, asset: str(d.token), amount: str(d.amount), counterparty: '' };
  }
}

export function receiptsCsv(items: ReceiptItem[], origin: string): string {
  const seen = new Set<string>();
  const rows = [...items].sort((a, b) => b.at - a.at).filter((a) => { const k = a.kind + a.tx; if (seen.has(k)) return false; seen.add(k); return true; });
  const lines = [CSV_COLUMNS.join(','), ...rows.map((a) => { const r = receiptRow(a, origin); return CSV_COLUMNS.map((c) => csvCell(r[c])).join(','); })];
  return lines.join('\r\n') + '\r\n';
}
export const csvFileName = (account: string, now = new Date()) => `pocket-receipts-${account.split('.')[0]}-${now.toISOString().slice(0, 10)}.csv`;

// RFC 4180 reader, used by tests and by anyone checking an export.
export function parseCsv(text: string): string[][] {
  const out: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; continue; }
    if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\r' && text[i + 1] === '\n') { row.push(cell); out.push(row); row = []; cell = ''; i++; }
    else if (c === '\n') { row.push(cell); out.push(row); row = []; cell = ''; } else cell += c;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out;
}
