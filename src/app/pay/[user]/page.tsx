'use client';
import { Suspense, use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AppShell, Brand, fmt } from '@/ui/kit';
import { AvatarFor } from '@/ui/Avatar';
import { StatusChip } from '@/ui/StatusChip';
import { useSession } from '@/lib/client/session';
import { getRequest, type RequestView } from '@/lib/client/api';
import { ROOT } from '@/lib/shared/deployment';
import { requestMemo, validRequestId } from '@/lib/shared/request';

function Pay({ user }: { user: string }) {
  const u = decodeURIComponent(user).replace(/^@/, '').toLowerCase();
  const rid = useSearchParams().get('r') || '';
  const s = useSession();
  const [st, setSt] = useState<'load' | 'ok' | 'no'>('load');
  const [req, setReq] = useState<RequestView | null>(null);
  const [reqErr, setReqErr] = useState('');
  useEffect(() => { fetch('/api/account/lookup?q=' + encodeURIComponent(u)).then((r) => r.json()).then((j) => setSt(j.exists && j.pocket ? 'ok' : 'no')).catch(() => setSt('no')); }, [u]);
  useEffect(() => {
    if (!rid) return;
    if (!validRequestId(rid)) { setReqErr('This request link is broken.'); return; }
    const load = () => getRequest(rid).then((r) => { if (r.account !== `${u}.${ROOT}`) { setReqErr('This request is not from @' + u + '.'); return; } setReq(r); }).catch((e) => setReqErr(e instanceof Error ? e.message : String(e)));
    load(); const t = setInterval(load, 10000); return () => clearInterval(t);
  }, [rid, u]);
  const payHref = req ? `/send/to?to=@${u}&asset=${req.token}&amt=${req.amount}&memo=${encodeURIComponent(requestMemo(req.id))}` : `/send/to?to=@${u}`;
  const mine = s?.username === u;
  return (
    <AppShell screen="pay" tab="send" noTabs>
      <header className="nav"><span className="nb" /><Brand /><span className="nb" /></header>
      <main className="body" style={{ alignItems: 'center', textAlign: 'center', gap: '1rem', paddingTop: '2rem' }}>
        <AvatarFor value="" name={u} size={88} />
        <div className="lt">@{u}</div>
        <div className="cs mono">{u}.{ROOT}</div>
        {req && <section className="group" aria-label="Money request" style={{ width: '100%', padding: '1rem', display: 'grid', gap: '.4rem' }}>
          <div className="fine">@{u} asks for</div>
          <div style={{ fontSize: '2.4rem', fontWeight: 700, lineHeight: 1.1 }}>{fmt(Number(req.amount))} <span style={{ fontSize: '.45em', opacity: 0.6 }}>{req.token}</span></div>
          {req.note && <div>&ldquo;{req.note}&rdquo;</div>}
          {req.due && req.status === 'pending' && <div className={req.overdue ? 'errline' : 'fine'} data-testid="due">{req.overdue ? 'Overdue: it was due ' : 'Due by '}{new Date(req.due).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}</div>}
          <div><StatusChip status={req.status} /></div>
          {req.status !== 'pending' && req.paidTx && <div className="fine">Paid by {req.payer}. <Link href={`/r/${req.paidTx}`}>Receipt</Link></div>}
          {req.status === 'refunded' && req.refundTx && <div className="fine">Refunded. <Link href={`/r/${req.refundTx}`}>Refund receipt</Link></div>}
        </section>}
        {reqErr && <div className="errline" role="alert">{reqErr}</div>}
        {st === 'load' && <div className="skel" style={{ height: '3rem', width: '100%' }} />}
        {st === 'no' && <div className="empty">There is no Pocket user called @{u}.</div>}
        {st === 'ok' && (req && req.status !== 'pending' ? null : s ? (mine ? <div className="empty">{req ? 'This is your request. It shows Paid as soon as the money arrives.' : 'This is your pay link. Share it so people can send to you.'}</div> : <Link className="btn big" style={{ width: '100%' }} href={payHref}>{req ? `Pay ${fmt(Number(req.amount))} ${req.token}` : `Pay @${u}`}</Link>)
          : <><Link className="btn big" style={{ width: '100%' }} href={`/welcome?next=${encodeURIComponent(payHref)}`}>Create a Pocket to pay @{u}</Link><div className="fine">Free, takes a few seconds, and you get 1,000 test dollars. Test money only.</div></>)}
      </main>
    </AppShell>
  );
}
export default function Page({ params }: { params: Promise<{ user: string }> }) {
  const { user } = use(params);
  return <Suspense><Pay user={user} /></Suspense>;
}
