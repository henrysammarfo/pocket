'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUp, Lock, Mic, ShieldCheck, Trash2 } from 'lucide-react';
import { AppShell, Brand, fmt, Sheet } from '@/ui/kit';
import { Gate } from '@/ui/Gate';
import { Avatar } from '@/ui/Avatar';
import { api } from '@/lib/client/api';
import { summary, useBalances, useQuotes } from '@/lib/client/data';
import { setChat, useChat, useContacts, useProfile, useRules, useSession, type ChatMsg } from '@/lib/client/session';
import type { Check, Plan, Step } from '@/lib/shared/plan';

const stepTitle = (s: Step) => (s.type === 'send' ? `Send to ${s.toLabel}` : `${s.type === 'buy' ? 'Buy' : 'Sell'} ${s.ticker}on`);
const stepSub = (s: Step) => (s.type === 'send' ? (s.note ? `Note: ${s.note}` : 'Gas paid by Pocket') : 'Paper stock, live CoinGecko price');
const stepVal = (s: Step) => (s.type === 'send' ? `$${fmt(s.amount)}` : `$${fmt(s.usd || 0)}`);

function PlanCard({ plan, check, keep, onReview, onChange }: { plan: Plan; check?: Check; keep: number; onReview: () => void; onChange: () => void }) {
  return (
    <section className="group plan" aria-label="Your plan">
      <div className="plan-h"><div className="ttl">Your plan</div>{check?.ok ? <span className="chip ok"><ShieldCheck size={13} aria-hidden />Within your rules</span> : <span className="chip" style={{ color: 'var(--danger)' }}><Lock size={13} aria-hidden />Blocked by your rules</span>}</div>
      <div className="cap plan-cap">Checked in code before anything moves</div>
      {plan.steps.map((s, i) => <div className="cell" key={i}><div className="cl"><div className="ct">{stepTitle(s)}</div><div className="cs">{stepSub(s)}</div></div><div className="cv">{stepVal(s)}</div></div>)}
      {keep > 0 && <div className="cell"><div className="cl"><div className="ct">Keep</div><div className="cs">Pinned rule</div></div><div className="cv">${fmt(keep)}</div></div>}
      <div className="acts2"><button className="btn ghost" onClick={onChange}>Change</button><button className="btn" onClick={onReview}>{check?.ok ? 'Review and approve' : 'See why'}</button></div>
    </section>
  );
}

function ChatInner() {
  const s = useSession()!;
  const msgs = useChat();
  const profile = useProfile();
  const rules = useRules();
  const contacts = useContacts();
  const b = useBalances();
  const q = useQuotes();
  const sm = summary(b.data, q.data);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<{ reasons: string[] } | null>(null);
  const body = useRef<HTMLElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  useEffect(() => { body.current?.scrollTo({ top: 1e6 }); }, [msgs.length, busy]);

  const ctx = () => ({ dollars: sm.dollars, pusd: sm.pusd, usdc: sm.usdc, near: sm.near, holdings: sm.holdings, keep: rules.keep, limit: b.data?.limit ?? rules.limit, usedToday: b.data?.usedToday ?? 0, prices: sm.prices, name: profile.name || s.username, contacts: contacts.map((c) => ({ name: c.name, address: c.address })) });
  const sendMsg = async (t: string) => {
    const content = t.trim();
    if (!content || busy) return;
    const next: ChatMsg[] = [...msgs, { role: 'user', content, at: Date.now() }];
    setChat(next); setText(''); setBusy(true);
    try {
      const r = await api<{ reply: string; plan?: Plan; check?: Check; source: string; model?: string }>('/api/chat', { messages: next.map((m) => ({ role: m.role, content: m.content })), ctx: ctx() });
      setChat([...next, { role: 'assistant', content: r.reply, at: Date.now(), plan: r.plan ? { plan: r.plan, check: r.check } : undefined, meta: [r.source === 'ai' ? (r.model?.includes('/') ? 'NEAR AI Cloud' : 'AI') : r.source === 'rules' ? 'Pocket rules parser' : 'AI is off', ...(r.plan ? [r.check?.ok ? 'Safety check passed' : 'Blocked by your rules', 'Prices read'] : [])] }]);
      if (r.check && !r.check.ok) setBlocked({ reasons: r.check.reasons });
    } catch (e) {
      setChat([...next, { role: 'assistant', content: 'I could not reach Pocket just now. ' + (e instanceof Error ? e.message : ''), at: Date.now() }]);
    } finally { setBusy(false); }
  };
  const review = (p: { plan: Plan; check?: Check }) => {
    if (!p.check?.ok) { setBlocked({ reasons: p.check?.reasons || [] }); return; }
    router.push('/review?plan=' + p.plan.id);
  };
  const greet = `Hi ${profile.name || '@' + s.username}. Your balance is $${fmt(sm.dollars)} in test dollars and nothing is waiting for you. What should your money do today?`;
  return (
    <AppShell screen="chat" tab="chat" overlay={
      <Sheet open={!!blocked} onClose={() => setBlocked(null)} label="Blocked by your rules" cls="sheet">
        <div className="bicon"><Lock size={30} strokeWidth={2.2} aria-hidden /></div><div className="btitle">Blocked by your rules</div>
        <div className="bwhy">{blocked?.reasons.join(' ')}</div>
        <div className="bsafe"><ShieldCheck size={20} aria-hidden /><span>Nothing moved. Your ${fmt(sm.dollars)} is still here.</span></div>
        <button className="btn big" onClick={() => setBlocked(null)}>Go back</button><Link className="btn text" href="/settings">See your rules</Link>
      </Sheet>
    }>
      <header className="nav"><button className="nb" aria-label="Clear chat" onClick={() => setChat([])}><Trash2 size={20} aria-hidden /></button><Brand /><Link href="/profile" aria-label="Profile"><Avatar size={36} cls="me-av" /></Link></header>
      <main className="body chat" ref={body}>
        <div className="thread">
          <div className="when">Today</div>
          <div className="ai">{b.data || b.error ? greet : <span className="typing" aria-label="Loading"><i /><i /><i /></span>}</div>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: 'contents' }}>
              <div className={m.role === 'user' ? 'me' : 'ai'}>{m.content}</div>
              {m.plan ? <PlanCard plan={(m.plan as { plan: Plan }).plan} check={(m.plan as { check?: Check }).check} keep={rules.keep} onReview={() => review(m.plan as { plan: Plan; check?: Check })} onChange={() => { setText((msgs[i - 1]?.content) || ''); ta.current?.focus(); }} /> : null}
              {m.meta && <div className="strip">{m.meta.map((x) => <span key={x} className={'chip' + (/passed|read/.test(x) ? ' ok' : '')}>{x}</span>)}</div>}
            </div>
          ))}
          {busy && <div className="ai"><span className="typing" aria-label="Pocket is thinking"><i /><i /><i /></span></div>}
        </div>
      </main>
      <div className="composer-wrap">
        <form className="composer" onSubmit={(e) => { e.preventDefault(); sendMsg(text); }}>
          <textarea ref={ta} className="inp" rows={1} aria-label="Message Pocket" placeholder="Tell Pocket what your money should do" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(text); } }} />
          <span className="cbtns"><button type="button" className="mic" aria-label="Speak (coming soon)" onClick={() => { setText((t) => t || 'Send Mum 20 dollars and put 10 in Tesla'); ta.current?.focus(); }}><Mic size={18} aria-hidden /></button><button className="sendb" aria-label="Send" disabled={busy || !text.trim()}><ArrowUp size={18} strokeWidth={2.4} aria-hidden /></button></span>
        </form>
      </div>
    </AppShell>
  );
}
export default function Page() { return <Gate><ChatInner /></Gate>; }
