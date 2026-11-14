'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUp, Lock, Mic, Paperclip, ShieldCheck, Square, Trash2, X } from 'lucide-react';
import { AppShell, Brand, fmt, Sheet, toast, toastErr } from '@/ui/kit';
import { speak, useVoice } from '@/ui/useVoice';
import { Gate } from '@/ui/Gate';
import { Avatar } from '@/ui/Avatar';
import { api } from '@/lib/client/api';
import { summary, useBalances, useQuotes } from '@/lib/client/data';
import { getChat, getRules, setChat, useChat, useContacts, useProfile, useRules, useSession, type ChatMsg } from '@/lib/client/session';
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
  const [svc, setSvc] = useState<{ ai: boolean; voice: boolean }>({ ai: false, voice: false });
  const body = useRef<HTMLElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useEffect(() => { body.current?.scrollTo({ top: 1e6 }); }, [msgs.length, busy]);
  useEffect(() => { fetch('/api/health').then((r) => r.json()).then((h) => setSvc({ ai: !!h?.services?.ai, voice: !!h?.services?.voice })).catch(() => {}); }, []);
  // A new device: pull past chats from the server (Neon) so the conversation carries on.
  useEffect(() => {
    if (msgs.length) return;
    api<{ items: { role: 'user' | 'assistant'; content: string; at: number; meta?: { plan?: Plan; check?: Check; voice?: boolean } | null }[] }>('/api/chat/history')
      .then((r) => { if (r.items?.length && !getChat().length) setChat(r.items.map((x) => ({ role: x.role, content: x.content, at: x.at, voice: !!x.meta?.voice, plan: x.meta?.plan ? { plan: x.meta.plan, check: x.meta.check } : undefined }))); })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ctx = () => ({ dollars: sm.dollars, pusd: sm.pusd, usdc: sm.usdc, near: sm.near, holdings: sm.holdings, keep: rules.keep, limit: b.data?.limit ?? rules.limit, usedToday: b.data?.usedToday ?? 0, prices: sm.prices, name: profile.name || s.username, contacts: contacts.map((c) => ({ name: c.name, address: c.address })) });
  const metaOf = (r: { source: string; model?: string; plan?: unknown; check?: Check }, voice?: boolean) => [
    ...(voice ? ['Heard your voice'] : []),
    r.source === 'ai' ? (r.model ? 'AI: ' + r.model.split('/').pop() : 'AI') : r.source === 'rules' ? 'Pocket rules parser' : 'AI is off',
    ...(r.plan ? [r.check?.ok ? 'Safety check passed' : 'Blocked by your rules', 'Prices read'] : []),
  ];
  type Out = { reply: string; plan?: Plan; check?: Check; confirm?: unknown; chips?: string[]; remembered?: string[]; source: string; model?: string };
  const land = (next: ChatMsg[], r: Out, voice?: boolean) => {
    setChat([...next, { role: 'assistant', content: r.reply, at: Date.now(), plan: r.plan ? { plan: r.plan, check: r.check } : undefined, confirm: r.confirm, chips: r.chips, meta: [...metaOf(r, voice), ...(r.remembered?.length ? ['Saved to memory'] : [])] }]);
    if (r.check && !r.check.ok) setBlocked({ reasons: r.check.reasons });
    if (getRules().speak) speak(r.reply);
  };
  const sendMsg = async (t: string, voice = false) => {
    const content = t.trim();
    if (!content || busy) return;
    const next: ChatMsg[] = [...getChat().map((m) => (m.chips ? { ...m, chips: undefined } : m)), { role: 'user', content, at: Date.now(), voice }];
    setChat(next); setText(''); setBusy(true);
    try {
      const r = await api<Out>('/api/chat', { messages: next.slice(-16).map((m) => ({ role: m.role, content: m.content })), ctx: ctx(), voice });
      land(next, r, voice);
    } catch (e) {
      setChat([...next, { role: 'assistant', content: 'I could not reach Pocket just now. ' + (e instanceof Error ? e.message : ''), at: Date.now() }]);
    } finally { setBusy(false); }
  };
  const chip = async (i: number, label: string) => {
    const m = getChat()[i];
    const next: ChatMsg[] = getChat().map((x, k) => (k === i ? { ...x, chips: undefined } : x));
    if (/^yes/i.test(label) && m?.confirm) {
      next.push({ role: 'user', content: label, at: Date.now() }); setChat(next); setBusy(true);
      try { land(next, await api<Out>('/api/chat', { confirm: m.confirm, ctx: ctx() })); } catch (e) { toastErr(e); } finally { setBusy(false); }
      return;
    }
    if (/^no/i.test(label)) { setChat([...next, { role: 'user', content: label, at: Date.now() }, { role: 'assistant', content: 'No problem. Say it again, or type it, and I will listen.', at: Date.now() }]); return; }
    sendMsg(label);
  };
  const voice = useVoice({ server: svc.voice, onText: (t) => sendMsg(t, true), onError: (m) => toast(m) });
  const pressT = useRef(0);
  const micDown = () => { if (voice.state === 'rec') return; pressT.current = Date.now(); voice.start(); };
  const micUp = () => { if (voice.state === 'rec' && Date.now() - pressT.current > 700) voice.stop(); };
  const micClick = () => { if (voice.state === 'rec' && Date.now() - pressT.current <= 700) return; if (voice.state === 'rec') voice.stop(); };
  const onFile = async (f?: File | null) => {
    if (!f) return;
    if (!svc.voice) { toast('Voice notes need the speech service, which is not set up here yet. Use the mic instead.'); return; }
    await voice.transcribe(f, f.name || 'note.m4a');
  };
  const review = (p: { plan: Plan; check?: Check }) => {
    if (!p.check?.ok) { setBlocked({ reasons: p.check?.reasons || [] }); return; }
    router.push('/review?plan=' + p.plan.id);
  };
  const clear = () => { setChat([]); api('/api/chat/history', undefined, 'DELETE').catch(() => {}); };
  const greet = `Hi ${profile.name || '@' + s.username}. Your balance is $${fmt(sm.dollars)} in test dollars. Ask me anything, or tell me what your money should do. You can also hold the mic and just talk.`;
  return (
    <AppShell screen="chat" tab="chat" overlay={
      <Sheet open={!!blocked} onClose={() => setBlocked(null)} label="Blocked by your rules" cls="sheet">
        <div className="bicon"><Lock size={30} strokeWidth={2.2} aria-hidden /></div><div className="btitle">Blocked by your rules</div>
        <div className="bwhy">{blocked?.reasons.join(' ')}</div>
        <div className="bsafe"><ShieldCheck size={20} aria-hidden /><span>Nothing moved. Your ${fmt(sm.dollars)} is still here.</span></div>
        <button className="btn big" onClick={() => setBlocked(null)}>Go back</button><Link className="btn text" href="/settings">See your rules</Link>
      </Sheet>
    }>
      <header className="nav"><button className="nb" aria-label="Clear chat" onClick={clear}><Trash2 size={20} aria-hidden /></button><Brand /><Link href="/profile" aria-label="Profile"><Avatar size={36} cls="me-av" /></Link></header>
      <main className="body chat" ref={body}>
        <div className="thread">
          <div className="when">Today</div>
          <div className="ai">{b.data || b.error ? greet : <span className="typing" aria-label="Loading"><i /><i /><i /></span>}</div>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: 'contents' }}>
              <div className={m.role === 'user' ? 'me' : 'ai'}>{m.voice && <Mic size={13} aria-label="Said by voice" style={{ marginRight: '.3rem', verticalAlign: '-2px', opacity: 0.7 }} />}{m.content}</div>
              {m.plan ? <PlanCard plan={(m.plan as { plan: Plan }).plan} check={(m.plan as { check?: Check }).check} keep={rules.keep} onReview={() => review(m.plan as { plan: Plan; check?: Check })} onChange={() => { setText((msgs[i - 1]?.content) || ''); ta.current?.focus(); }} /> : null}
              {m.chips && <div className="chips">{m.chips.map((c) => <button key={c} className="chipbtn" onClick={() => chip(i, c)}>{c}</button>)}</div>}
              {m.meta && <div className="strip">{m.meta.map((x) => <span key={x} className={'chip' + (/passed|read|Heard|Saved/.test(x) ? ' ok' : '')}>{x}</span>)}</div>}
            </div>
          ))}
          {busy && <div className="ai"><span className="typing" aria-label="Pocket is thinking"><i /><i /><i /></span></div>}
          {voice.state === 'busy' && <div className="me"><span className="typing" aria-label="Writing down what you said"><i /><i /><i /></span></div>}
        </div>
      </main>
      <div className="composer-wrap">
        {voice.state === 'rec' ? (
          <div className="composer rec" role="status">
            <div className="recline"><span className="recdot" /><b>Listening</b><span className="mono">{Math.floor(voice.secs / 60)}:{String(voice.secs % 60).padStart(2, '0')}</span><span className="rechint">{voice.live || (voice.mode === 'browser' ? 'Speak now. Your browser is listening.' : 'Speak freely. Messy is fine.')}</span></div>
            <span className="cbtns"><button type="button" className="mic" aria-label="Cancel" onClick={voice.cancel}><X size={18} aria-hidden /></button><button type="button" className="sendb" aria-label="Stop and send" onClick={voice.stop}><Square size={14} fill="currentColor" aria-hidden /></button></span>
          </div>
        ) : (
          <form className="composer" onSubmit={(e) => { e.preventDefault(); sendMsg(text); }}>
            <textarea ref={ta} className="inp" rows={1} aria-label="Message Pocket" placeholder="Talk to Pocket about anything" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(text); } }} />
            <span className="cbtns">
              <input ref={file} type="file" accept="audio/*,.m4a,.mp3,.ogg,.opus,.wav,.webm" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
              <button type="button" className="mic" aria-label="Upload a voice note" onClick={() => file.current?.click()} disabled={voice.state !== 'idle'}><Paperclip size={18} aria-hidden /></button>
              <button type="button" className="mic" aria-label={voice.available ? 'Hold or tap to talk' : 'Voice not available in this browser'} disabled={!voice.available || voice.state !== 'idle' || busy}
                onPointerDown={micDown} onPointerUp={micUp} onClick={micClick} onContextMenu={(e) => e.preventDefault()}><Mic size={18} aria-hidden /></button>
              <button className="sendb" aria-label="Send" disabled={busy || !text.trim()}><ArrowUp size={18} strokeWidth={2.4} aria-hidden /></button>
            </span>
          </form>
        )}
        <div className="cfoot">{svc.ai ? 'AI chat is on. Money moves only after you approve.' : 'AI chat is off on this server, so Pocket reads money commands with its own rules.'}{voice.mode === 'browser' ? ' Voice uses your browser.' : ''}</div>
      </div>
    </AppShell>
  );
}
export default function Page() { return <Gate><ChatInner /></Gate>; }
