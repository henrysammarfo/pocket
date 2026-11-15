'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Copy } from 'lucide-react';
import { AppShell, BackNav, fmt, toast, toastErr } from '@/ui/kit';
import { Gate } from '@/ui/Gate';
import { copy } from '@/ui/sheets';
import { createRequest, myRequests, type RequestView } from '@/lib/client/api';
import { cleanRequest, refundMemo } from '@/lib/shared/request';
import { when } from '@/lib/client/data';
import { StatusChip } from '@/ui/StatusChip';

function RequestInner() {
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState<'pUSD' | 'USDC'>('pUSD');
  const [note, setNote] = useState('');
  const [due, setDue] = useState('');
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<RequestView[] | null>(null);
  const load = () => myRequests().then((r) => setItems(r.items)).catch(() => setItems([]));
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);
  const c = cleanRequest({ amount, token, note, due });
  const make = async () => {
    setBusy(true);
    try { const r = await createRequest(amount, token, note, due); copy(window.location.origin + r.path, 'Request link copied'); setAmount(''); setNote(''); setDue(''); load(); } catch (e) { toastErr(e); } finally { setBusy(false); }
  };
  return (
    <AppShell screen="request" tab="wallet">
      <BackNav href="/wallet" title="Request money" />
      <main className="body">
        <section className="group" style={{ padding: '1rem', display: 'grid', gap: '.6rem' }}>
          <label className="field"><input className="inp" inputMode="decimal" aria-label="Amount" placeholder="Amount, like 25" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <div style={{ display: 'flex', gap: '.5rem' }}>{(['pUSD', 'USDC'] as const).map((t) => <button key={t} className={'chip' + (token === t ? ' ok' : '')} aria-pressed={token === t} onClick={() => setToken(t)}>{t}</button>)}</div>
          <label className="field"><input className="inp" aria-label="What it is for" placeholder="What it is for (optional)" maxLength={80} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <label className="field"><span className="in" style={{ flex: '0 0 auto', color: 'var(--ink-2)' }}>Due by</span><input className="inp" type="date" aria-label="Due by (optional)" value={due} onChange={(e) => setDue(e.target.value)} /></label>
          {(amount || due) && !c.ok && <div className="errline" role="alert">{c.reason}</div>}
          <button className="btn big" disabled={!c.ok || busy} onClick={make}>{busy ? 'Making link' : 'Make request link'}</button>
          <div className="fine">Anyone with the link can pay you. It shows Pending until the money arrives, then Paid, and Refunded if you send it back.</div>
        </section>
        <div className="ghead"><b>Your requests</b></div>
        <section className="group list">
          {items === null && <div className="skel" style={{ height: '3.5rem', margin: '.5rem' }} />}
          {items?.length === 0 && <div className="empty">No requests yet.</div>}
          {items?.map((r) => (
            <div className="row" key={r.id} data-request={r.id}>
              <span className="rn"><span className="nm">{fmt(Number(r.amount))} {r.token}{r.note ? `, ${r.note}` : ''}</span><span className="sb">{when(r.at)}{r.payer ? `, from ${r.payer}` : ''}{r.due && r.status === 'pending' ? (r.overdue ? ', overdue' : `, due ${new Date(r.due).toLocaleDateString([], { day: 'numeric', month: 'short', timeZone: 'UTC' })}`) : ''}</span></span>
              <span className="px" style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}>
                <StatusChip status={r.status} />
                {r.status === 'pending' && r.path && <button className="nb" aria-label="Copy link" onClick={() => copy(window.location.origin + r.path, 'Request link copied')}><Copy size={16} aria-hidden /></button>}
                {r.status === 'paid' && r.payer && <Link className="chip" href={`/send/to?to=${encodeURIComponent(r.payer)}&asset=${r.token}&amt=${r.paidAmount || r.amount}&memo=${encodeURIComponent(refundMemo(r.id))}`} onClick={() => toast('Send it back to refund')}>Refund</Link>}
                {r.paidTx && <Link className="chip" href={`/r/${r.paidTx}`}>Receipt</Link>}
              </span>
            </div>
          ))}
        </section>
      </main>
    </AppShell>
  );
}
export default function Page() { return <Gate><RequestInner /></Gate>; }
