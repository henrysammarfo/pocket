'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check as CheckIcon, ExternalLink, History, Loader2, ShieldCheck, StickyNote, X } from 'lucide-react';
import { AppShell, BackNav, fmt, HoldButton, toastErr } from '@/ui/kit';
import { Gate } from '@/ui/Gate';
import { AvatarFor } from '@/ui/Avatar';
import { getQuote, passkeyApprove, send, trade } from '@/lib/client/api';
import { resolveRecipient, summary, useBalances, useQuotes, when } from '@/lib/client/data';
import { getContacts, getRules, useChat, useRules } from '@/lib/client/session';
import { checkPlan, type Plan, type Step } from '@/lib/shared/plan';
import { txUrl } from '@/lib/shared/deployment';

type Res = { state: 'wait' | 'run' | 'ok' | 'err'; hash?: string; msg?: string };

function ReviewInner() {
  const id = useSearchParams().get('plan');
  const msgs = useChat();
  const rules = useRules();
  const router = useRouter();
  const b = useBalances(); const q = useQuotes(); const sm = summary(b.data, q.data);
  const plan = useMemo(() => msgs.map((m) => (m.plan as { plan?: Plan } | undefined)?.plan).find((p) => p?.id === id) || null, [msgs, id]);
  const [res, setRes] = useState<Res[]>([]);
  const [running, setRunning] = useState(false);
  const [snap, setSnap] = useState<number | null>(null);
  const [resolved, setResolved] = useState<Record<number, string>>({});
  useEffect(() => {
    if (!plan) return;
    plan.steps.forEach(async (s, i) => { if (s.type === 'send') { const r = await resolveRecipient(s.to); setResolved((x) => ({ ...x, [i]: 'error' in r ? '!' + r.error : r.account })); } });
  }, [plan]);
  if (!plan) return <AppShell screen="review" tab="chat" noTabs><BackNav href="/chat" title="Review" /><main className="body review"><div className="empty">This plan is no longer here. Ask Pocket again in Chat.</div><Link className="btn" href="/chat">Back to Chat</Link></main></AppShell>;

  const ctx = { dollars: sm.dollars, pusd: sm.pusd, usdc: sm.usdc, near: sm.near, holdings: sm.holdings, keep: rules.keep, limit: b.data?.limit ?? rules.limit, usedToday: b.data?.usedToday ?? 0, prices: sm.prices };
  const chk = b.data && q.data ? checkPlan(plan, ctx) : null;
  const sends = plan.steps.filter((s) => s.type === 'send') as Extract<Step, { type: 'send' }>[];
  const single = plan.steps.length === 1 && sends.length === 1 ? sends[0] : null;
  const contact = single ? getContacts().find((c) => c.name.toLowerCase() === single.toLabel.toLowerCase() || c.address === resolved[0]) : undefined;
  const total = plan.steps.reduce((a, s) => a + (s.type === 'send' ? s.amount : s.type === 'buy' ? s.usd || 0 : 0), 0);
  const badRecipient = Object.values(resolved).find((v) => v.startsWith('!'));
  const pick = (amt: number, left: { pusd: number; usdc: number }) => (left.pusd >= amt ? 'pUSD' : left.usdc >= amt ? 'USDC' : null);

  const run = async () => {
    setRunning(true); setSnap(chk?.after ?? null);
    const out: Res[] = plan.steps.map(() => ({ state: 'wait' }));
    setRes([...out]);
    try { if (getRules().passkey) await passkeyApprove(getRules().passkeyId); } catch (e) { toastErr(e); setRunning(false); setRes([]); return; }
    const left = { pusd: sm.pusd, usdc: sm.usdc };
    for (let i = 0; i < plan.steps.length; i++) {
      const s = plan.steps[i];
      out[i] = { state: 'run' }; setRes([...out]);
      try {
        if (s.type === 'send') {
          const to = resolved[i] && !resolved[i].startsWith('!') ? resolved[i] : await resolveRecipient(s.to).then((r) => { if ('error' in r) throw new Error(r.error); return r.account; });
          const asset = s.asset === 'auto' ? pick(s.amount, left) : s.asset;
          if (!asset) throw new Error('Not enough test dollars for this send.');
          const r = await send({ to, amount: String(s.amount), asset, memo: s.note, toName: s.toLabel });
          if (asset === 'pUSD') left.pusd -= s.amount; else if (asset === 'USDC') left.usdc -= s.amount;
          out[i] = { state: 'ok', hash: r.hash };
        } else {
          const qt = await getQuote(s.type, s.ticker + 'on', s.usd ? { usd: s.usd } : { qty: s.qty });
          const r = await trade(qt);
          if (s.type === 'buy') left.pusd -= r.usd;
          out[i] = { state: 'ok', hash: r.hash, msg: `${fmt(Number(r.qty), 4)} ${s.ticker}on at $${fmt(r.price)}` };
        }
      } catch (e) { out[i] = { state: 'err', msg: e instanceof Error ? e.message : String(e) }; }
      setRes([...out]);
    }
    setRunning(false);
  };
  const done = res.length > 0 && !running;
  const label = single ? `Hold to send $${fmt(single.amount)}` : `Hold to approve $${fmt(total)}`;

  return (
    <AppShell screen="review" tab="chat" noTabs>
      <BackNav href="/chat" title="Review" />
      <main className="body review">
        <div className="who">
          {single ? <AvatarFor value="" name={single.toLabel.replace('@', '')} size={64} cls="av" /> : <span className="av"><ShieldCheck size={28} aria-hidden /></span>}
          <div className="big">${fmt(total)}</div>
          <div className="to">{single ? <>to <b>{single.toLabel}</b>, {resolved[0] && !resolved[0].startsWith('!') ? resolved[0] : '…'} </> : <>{plan.steps.length} steps in one approval </>}{chk?.ok ? <span className="chip ok"><ShieldCheck size={12} aria-hidden />Checked</span> : null}</div>
        </div>
        <section className="group bd">
          {plan.steps.map((s, i) => {
            const r = res[i];
            const icon = r?.state === 'run' ? <Loader2 size={14} className="rot" aria-hidden /> : r?.state === 'ok' ? <CheckIcon size={14} aria-hidden /> : r?.state === 'err' ? <X size={14} aria-hidden /> : null;
            return (
              <div className={'cell' + (r?.state === 'err' ? ' bad' : '')} key={i}>
                <span className="k">{icon} {s.type === 'send' ? `Send to ${s.toLabel}` : `${s.type === 'buy' ? 'Buy' : 'Sell'} ${s.ticker}on`}</span>
                <span className="v">{s.type === 'send' ? `$${fmt(s.amount)}` : s.usd ? `$${fmt(s.usd)}` : `${s.qty} shares`}
                  <small>{r?.state === 'ok' && r.hash ? <a href={`/r/${r.hash}`}>{r.msg || 'Receipt'} <ExternalLink size={11} aria-hidden /></a> : r?.state === 'err' ? r.msg : s.type === 'send' ? (resolved[i]?.startsWith('!') ? resolved[i].slice(1) : 'Pocket pays the gas') : 'Live price, 0.20% spread'}</small>
                </span>
              </div>
            );
          })}
          <div className="cell"><span className="k">Network fee</span><span className="v">0.00<small>Pocket pays it</small></span></div>
          <div className="cell"><span className="k">Arrives</span><span className="v">about 2 s</span></div>
          {chk && <div className="cell after"><span className="k">Your balance after</span><span className="v">${fmt(snap ?? chk.after)}</span></div>}
        </section>
        {contact?.sends ? <div className="trust"><History size={16} aria-hidden />You&apos;ve sent {contact.name} {contact.sends} {contact.sends === 1 ? 'time' : 'times'}.{contact.lastAt ? ` Last time ${when(contact.lastAt)}.` : ''}</div> : null}
        {single?.note && <div className="note"><StickyNote size={16} aria-hidden /><span>Note: <b>{single.note}</b></span></div>}
        {chk && !chk.ok && <div className="errline" role="alert">{chk.reasons.join(' ')}</div>}
        {badRecipient && <div className="errline" role="alert">{badRecipient.slice(1)}</div>}
        <div className="holdwrap">
          {done ? (
            <div className="acts2"><Link className="btn ghost" href="/wallet">See wallet</Link><button className="btn" onClick={() => router.push('/chat')}>Back to Chat</button></div>
          ) : (
            <HoldButton label={label} doneLabel={running ? 'Working' : 'Done'} hint={single ? 'Keep holding to send' : 'Keep holding to approve'} onDone={run} disabled={(!chk?.ok && !running) || !!badRecipient || running} />
          )}
          <div className="fine">Test money on NEAR testnet. Nothing real moves.{rules.passkey ? ' Your passkey is asked after you hold.' : ''}</div>
          {res.some((r) => r.hash) && <div className="fine">{res.filter((r) => r.hash).map((r) => <a key={r.hash} href={txUrl(r.hash!)} target="_blank" rel="noreferrer" style={{ marginRight: '.6rem' }}>Explorer <ExternalLink size={11} aria-hidden /></a>)}</div>}
        </div>
      </main>
    </AppShell>
  );
}
export default function Page() { return <Gate><Suspense><ReviewInner /></Suspense></Gate>; }
