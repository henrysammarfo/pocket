'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUp, ExternalLink, Globe, Lock, Mic, PanelLeft, Paperclip, Pencil, ShieldCheck, Square, SquarePen, Trash2, X } from 'lucide-react';
import { AppShell, Brand, fmt, Sheet, toast, toastErr } from '@/ui/kit';
import { speak, useVoice } from '@/ui/useVoice';
import { Gate } from '@/ui/Gate';
import { Avatar } from '@/ui/Avatar';
import { api } from '@/lib/client/api';
import { resolveRecipient, summary, useBalances, useQuotes } from '@/lib/client/data';
import { dropThread, getChat, getRules, getThreadId, getThreads, newThreadId, renameThreadLocal, setChat, setThreadId, setThreads, touchThread, useChat, useContacts, useProfile, useRules, useSession, useThreadId, useThreads, type ChatMsg, type WebProduct, type WebSource } from '@/lib/client/session';
import type { Balances } from '@/lib/client/data';
import type { Check, Plan, Step } from '@/lib/shared/plan';

const stepTitle = (s: Step) => (s.type === 'send' ? `Send to ${s.toLabel}` : `${s.type === 'buy' ? 'Buy' : 'Sell'} ${s.ticker}on`);
const stepSub = (s: Step) => (s.type === 'send' ? (s.note ? `Note: ${s.note}` : 'Gas paid by Pocket') : 'Paper stock, live CoinGecko price');
const stepVal = (s: Step) => (s.type === 'send' ? `$${fmt(s.amount)}` : `$${fmt(s.usd || 0)}`);

function PlanCard({ plan, check, keep, onReview, onChange }: { plan: Plan; check?: Check; keep: number; onReview: () => void; onChange: () => void }) {
  // Check every recipient before the review screen, so "send mum 10" says who is missing right on the card.
  const [who, setWho] = useState<string[]>([]);
  useEffect(() => {
    let dead = false;
    Promise.all(plan.steps.map((st) => (st.type === 'send' ? resolveRecipient(st.to).then((r) => ('error' in r ? r.error : '')).catch(() => '') : Promise.resolve('')))).then((e) => { if (!dead) setWho(e.filter(Boolean)); });
    return () => { dead = true; };
  }, [plan.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const ok = check?.ok && !who.length;
  return (
    <section className="group plan" aria-label="Your plan">
      <div className="plan-h"><div className="ttl">Your plan</div>{ok ? <span className="chip ok"><ShieldCheck size={13} aria-hidden />Within your rules</span> : who.length && check?.ok ? <span className="chip" style={{ color: 'var(--warn-ink)' }}><Lock size={13} aria-hidden />Needs a recipient</span> : <span className="chip" style={{ color: 'var(--danger)' }}><Lock size={13} aria-hidden />Blocked by your rules</span>}</div>
      <div className="cap plan-cap">Checked in code before anything moves</div>
      {plan.steps.map((s, i) => <div className="cell" key={i}><div className="cl"><div className="ct">{stepTitle(s)}</div><div className="cs">{stepSub(s)}</div></div><div className="cv">{stepVal(s)}</div></div>)}
      {keep > 0 && <div className="cell"><div className="cl"><div className="ct">Keep</div><div className="cs">Pinned rule</div></div><div className="cv">${fmt(keep)}</div></div>}
      {who.map((w) => <div className="plan-warn" key={w} role="alert">{w}</div>)}
      <div className="acts2"><button className="btn ghost" onClick={onChange}>Change</button>{who.length && check?.ok ? <Link className="btn" href="/contacts">Add contact</Link> : <button className="btn" onClick={onReview}>{check?.ok ? 'Review and approve' : 'See why'}</button>}</div>
    </section>
  );
}

const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'now' : m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' d'; };

function Threads({ open, onClose, onNew, onPick }: { open: boolean; onClose: () => void; onNew: () => void; onPick: (id: string) => void }) {
  const list = useThreads(); const cur = useThreadId();
  const [edit, setEdit] = useState(''); const [name, setName] = useState(''); const [del, setDel] = useState('');
  const save = (id: string) => { const t = name.trim(); setEdit(''); if (!t) return; renameThreadLocal(id, t); api('/api/chat/threads', { id, title: t }, 'PATCH').catch(() => {}); };
  const remove = (id: string) => { setDel(''); dropThread(id); api('/api/chat/history?thread=' + id, undefined, 'DELETE').catch(() => {}); if (id === cur) onNew(); };
  return (
    <>
      <div className={'tscrim' + (open ? ' on' : '')} onClick={onClose} aria-hidden />
      <aside className={'tpanel' + (open ? ' open' : '')} aria-label="Your chats">
        <div className="tp-h"><b>Chats</b><button className="nb tp-x" aria-label="Close chats" onClick={onClose}><X size={20} aria-hidden /></button></div>
        <button className="btn tp-new" onClick={onNew}><SquarePen size={18} aria-hidden />New chat</button>
        <div className="tp-list">
          {!list.length && <div className="tp-empty">Your chats show up here. Start one and it is saved to your account.</div>}
          {list.map((t) => (
            <div key={t.id} className={'tp-row' + (t.id === cur ? ' on' : '')}>
              {edit === t.id ? (
                <form className="tp-edit" onSubmit={(e) => { e.preventDefault(); save(t.id); }}><input autoFocus aria-label="Chat name" value={name} maxLength={48} onChange={(e) => setName(e.target.value)} onBlur={() => save(t.id)} /></form>
              ) : del === t.id ? (
                <div className="tp-del"><span>Delete this chat?</span><button onClick={() => setDel('')}>Cancel</button><button className="danger" onClick={() => remove(t.id)}>Delete</button></div>
              ) : (
                <>
                  <button className="tp-open" onClick={() => onPick(t.id)}><span className="tp-t">{t.title}</span><span className="tp-a">{ago(t.at)}</span></button>
                  <button className="tp-ic" aria-label={'Rename ' + t.title} onClick={() => { setEdit(t.id); setName(t.title); }}><Pencil size={15} aria-hidden /></button>
                  <button className="tp-ic" aria-label={'Delete ' + t.title} onClick={() => setDel(t.id)}><Trash2 size={15} aria-hidden /></button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="tp-foot">Chats are saved to your Pocket account behind a signed session. Keys and passwords are never stored.</div>
      </aside>
    </>
  );
}

// Shrink a photo in the browser before it leaves the device: max 1280 px, JPEG.
async function shrink(f: File, max = 1280, q = 0.82): Promise<string> {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('That file is not a photo I can read.')); i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', q);
  } finally { URL.revokeObjectURL(url); }
}

function Found({ sources, products }: { sources?: WebSource[]; products?: WebProduct[] }) {
  if (!sources?.length && !products?.length) return null;
  return (
    <div className="found">
      {!!products?.length && <div className="prods">{products.map((p) => (
        <a key={p.url} className="prod" href={p.url} target="_blank" rel="noopener noreferrer">
          <span className="pimg">{p.image ? <img src={p.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : null}<span className="pfb">{p.store.slice(0, 1).toUpperCase()}</span></span>
          <span className="pt">{p.title}</span><span className="pp">{p.price || 'See price'}</span><span className="ps">{p.store}{p.rating ? ' · ' + p.rating.split(' from ')[0] + ' stars' : ''}</span>
        </a>))}</div>}
      {!!sources?.length && <div className="srcs"><Globe size={13} aria-hidden /><span>Sources</span>{sources.map((x) => { let h = x.url; try { h = new URL(x.url).hostname.replace(/^www\./, ''); } catch {} return <a key={x.url} href={x.url} target="_blank" rel="noopener noreferrer" title={x.title}>{h}<ExternalLink size={11} aria-hidden /></a>; })}</div>}
    </div>
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
  const [svc, setSvc] = useState<{ ai: boolean; voice: boolean; vision: boolean }>({ ai: false, voice: false, vision: false });
  const [drawer, setDrawer] = useState(false);
  const [photo, setPhoto] = useState('');
  const thread = useThreadId();
  const body = useRef<HTMLElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useEffect(() => { body.current?.scrollTo({ top: 1e6 }); }, [msgs.length, busy]);
  useEffect(() => { fetch('/api/health').then((r) => r.json()).then((h) => setSvc({ ai: !!h?.services?.ai, voice: !!h?.services?.voice, vision: !!h?.services?.vision })).catch(() => {}); }, []);
  // Past chats live on the server (Neon) too, so a new device carries on: the list, then the open chat.
  useEffect(() => {
    api<{ items: { id: string; title: string; at: number }[] }>('/api/chat/threads').then((r) => {
      const local = getThreads(); const ids = new Set(local.map((t) => t.id));
      const merged = [...local, ...(r.items || []).filter((t) => !ids.has(t.id))].sort((a, b) => b.at - a.at);
      if (merged.length !== local.length) setThreads(merged);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (msgs.length) return;
    const id = thread;
    api<{ items: { role: 'user' | 'assistant'; content: string; at: number; meta?: { plan?: Plan; check?: Check; voice?: boolean; photo?: boolean; sources?: WebSource[]; products?: WebProduct[] } | null }[] }>('/api/chat/history?thread=' + id)
      .then((r) => { if (r.items?.length && getThreadId() === id && !getChat().length) setChat(r.items.map((x) => ({ role: x.role, content: x.content, at: x.at, voice: !!x.meta?.voice, sources: x.meta?.sources, products: x.meta?.products, plan: x.meta?.plan ? { plan: x.meta.plan, check: x.meta.check } : undefined })), id); })
      .catch(() => {});
  }, [thread]); // eslint-disable-line react-hooks/exhaustive-deps
  const newChat = () => { setThreadId(newThreadId()); setDrawer(false); setText(''); setPhoto(''); setTimeout(() => ta.current?.focus(), 50); };
  const pick = (id: string) => { setThreadId(id); setDrawer(false); };

  // Balances may still be loading right after sign up; read them first so the plan is checked against real money.
  const ctxNow = async () => {
    if (b.data) return ctx();
    try { const fresh = await api<Balances>(`/api/balances?account=${encodeURIComponent(s.account)}`); const f = summary(fresh, q.data); return { ...ctx(), dollars: f.dollars, pusd: f.pusd, usdc: f.usdc, near: f.near, holdings: f.holdings, limit: fresh.limit ?? rules.limit, usedToday: fresh.usedToday ?? 0 }; } catch { return ctx(); }
  };
  const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'UTC'; } };
  const ctx = () => ({ tz: tz(), dollars: sm.dollars, pusd: sm.pusd, usdc: sm.usdc, near: sm.near, holdings: sm.holdings, keep: rules.keep, limit: b.data?.limit ?? rules.limit, usedToday: b.data?.usedToday ?? 0, prices: sm.prices, name: profile.name || s.username, contacts: contacts.map((c) => ({ name: c.name, address: c.address })) });
  const metaOf = (r: { source: string; model?: string; plan?: unknown; check?: Check }, voice?: boolean) => [
    ...(voice ? ['Heard your voice'] : []),
    r.source === 'ai' ? (r.model ? 'AI: ' + r.model.split('/').pop() : 'AI') : r.source === 'rules' ? 'Pocket rules parser' : 'AI is off',
    ...(r.plan ? [r.check?.ok ? 'Safety check passed' : 'Blocked by your rules', 'Prices read'] : []),
  ];
  type Out = { reply: string; plan?: Plan; check?: Check; confirm?: unknown; chips?: string[]; remembered?: string[]; source: string; model?: string; sources?: WebSource[]; products?: WebProduct[]; searched?: boolean; photoText?: string };
  const land = (next: ChatMsg[], r: Out, voice?: boolean, id = getThreadId()) => {
    setChat([...next, { role: 'assistant', content: r.reply, at: Date.now(), plan: r.plan ? { plan: r.plan, check: r.check } : undefined, confirm: r.confirm, chips: r.chips, sources: r.sources, products: r.products, meta: [...metaOf(r, voice), ...(r.searched ? ['Searched the web'] : []), ...(r.remembered?.length ? ['Saved to memory'] : [])] }], id);
    if (r.check && !r.check.ok) setBlocked({ reasons: r.check.reasons });
    if (getRules().speak) speak(r.reply);
  };
  const sendMsg = async (t: string, voice = false) => {
    const pic = photo;
    const content = t.trim() || (pic ? 'What is in this photo?' : '');
    if (!content || busy) return;
    const id = getThreadId();
    const thumb = pic ? await shrink(await (await fetch(pic)).blob() as File, 360, 0.6).catch(() => '') : '';
    const next: ChatMsg[] = [...getChat().map((m) => (m.chips ? { ...m, chips: undefined } : m)), { role: 'user', content, at: Date.now(), voice, photo: thumb || undefined }];
    setChat(next, id); touchThread(id, content); setText(''); setPhoto(''); setBusy(true);
    try {
      const r = await api<Out>('/api/chat', { messages: next.slice(-16).map((m) => ({ role: m.role, content: m.photoText ? `${m.content}\n\n[Photo the user shared earlier, read by Pocket: ${m.photoText}]` : m.content })), ctx: await ctxNow(), voice, thread: id, ...(pic ? { image: pic } : {}) });
      const withPhoto = r.photoText ? next.map((m, k) => (k === next.length - 1 ? { ...m, photoText: r.photoText } : m)) : next;
      land(withPhoto, r, voice, id); touchThread(id);
    } catch (e) {
      setChat([...next, { role: 'assistant', content: 'I could not reach Pocket just now. ' + (e instanceof Error ? e.message : ''), at: Date.now() }], id);
    } finally { setBusy(false); }
  };
  const chip = async (i: number, label: string) => {
    const m = getChat()[i];
    const next: ChatMsg[] = getChat().map((x, k) => (k === i ? { ...x, chips: undefined } : x));
    if (/^yes/i.test(label) && m?.confirm) {
      next.push({ role: 'user', content: label, at: Date.now() }); setChat(next); setBusy(true);
      try { land(next, await api<Out>('/api/chat', { confirm: m.confirm, ctx: await ctxNow(), thread: getThreadId() })); } catch (e) { toastErr(e); } finally { setBusy(false); }
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
    if (f.type.startsWith('image/')) {
      if (!svc.vision) { toast('Reading photos needs the AI, which is not available right now.'); return; }
      try { setPhoto(await shrink(f)); ta.current?.focus(); } catch (e) { toastErr(e); }
      return;
    }
    if (!svc.voice) { toast('Voice notes need the speech service, which is not set up here yet. Use the mic instead.'); return; }
    await voice.transcribe(f, f.name || 'note.m4a');
  };
  const review = (p: { plan: Plan; check?: Check }) => {
    if (!p.check?.ok) { setBlocked({ reasons: p.check?.reasons || [] }); return; }
    router.push('/review?plan=' + p.plan.id);
  };
  const greet = `Hi ${profile.name || '@' + s.username}. Your balance is $${fmt(sm.dollars)} in test dollars. Ask me anything, or tell me what your money should do. You can also hold the mic and just talk, or share a photo of a bill.`;
  return (
    <AppShell screen="chat" tab="chat" overlay={
      <Sheet open={!!blocked} onClose={() => setBlocked(null)} label="Blocked by your rules" cls="sheet">
        <div className="bicon"><Lock size={30} strokeWidth={2.2} aria-hidden /></div><div className="btitle">Blocked by your rules</div>
        <div className="bwhy">{blocked?.reasons.join(' ')}</div>
        <div className="bsafe"><ShieldCheck size={20} aria-hidden /><span>Nothing moved. Your ${fmt(sm.dollars)} is still here.</span></div>
        <button className="btn big" onClick={() => setBlocked(null)}>Go back</button><Link className="btn text" href="/settings">See your rules</Link>
      </Sheet>
    }>
      <Threads open={drawer} onClose={() => setDrawer(false)} onNew={newChat} onPick={pick} />
      <header className="nav"><button className="nb" aria-label="Chats" onClick={() => setDrawer(true)}><PanelLeft size={21} aria-hidden /></button><Brand /><span className="nav-r"><button className="nb" aria-label="New chat" onClick={newChat}><SquarePen size={20} aria-hidden /></button><Link href="/profile" aria-label="Profile"><Avatar size={36} cls="me-av" /></Link></span></header>
      <main className="body chat" ref={body}>
        <div className="thread">
          <div className="when">Today</div>
          <div className="ai">{b.data || b.error ? greet : <span className="typing" aria-label="Loading"><i /><i /><i /></span>}</div>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: 'contents' }}>
              {m.photo && <img className="mephoto" src={m.photo} alt="Photo you shared" />}
              <div className={m.role === 'user' ? 'me' : 'ai'}>{m.voice && <Mic size={13} aria-label="Said by voice" style={{ marginRight: '.3rem', verticalAlign: '-2px', opacity: 0.7 }} />}{m.content}</div>
              {m.role === 'assistant' && <Found sources={m.sources} products={m.products} />}
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
            {photo && <div className="cphoto"><img src={photo} alt="Photo to send" /><span>Photo ready. Ask about it, or say who to split it with.</span><button type="button" aria-label="Remove photo" onClick={() => setPhoto('')}><X size={16} aria-hidden /></button></div>}
            <textarea ref={ta} className="inp" rows={1} aria-label="Message Pocket" placeholder="Talk to Pocket about anything" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(text); } }} />
            <span className="cbtns">
              <input ref={file} type="file" accept="image/jpeg,image/png,image/webp,audio/*,.m4a,.mp3,.ogg,.opus,.wav,.webm" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
              <button type="button" className="mic" aria-label="Attach a photo or voice note" onClick={() => file.current?.click()} disabled={voice.state !== 'idle'}><Paperclip size={18} aria-hidden /></button>
              <span className="cright">
                <button type="button" className="mic" aria-label={voice.available ? 'Hold or tap to talk' : 'Voice not available in this browser'} disabled={!voice.available || voice.state !== 'idle' || busy}
                  onPointerDown={micDown} onPointerUp={micUp} onClick={micClick} onContextMenu={(e) => e.preventDefault()}><Mic size={18} aria-hidden /></button>
                <button className="sendb" aria-label="Send" disabled={busy || (!text.trim() && !photo)}><ArrowUp size={18} strokeWidth={2.4} aria-hidden /></button>
              </span>
            </span>
          </form>
        )}
        <div className="cfoot">{svc.ai ? 'AI chat is on. Money moves only after you approve.' : 'AI chat is off on this server, so Pocket reads money commands with its own rules.'}{voice.mode === 'browser' ? ' Voice uses your browser.' : ''}</div>
      </div>
    </AppShell>
  );
}
export default function Page() { return <Gate><ChatInner /></Gate>; }
