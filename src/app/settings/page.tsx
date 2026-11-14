'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookUser, Check, ChevronRight, Gauge, Sparkles, Brain, Volume2, Globe, HeartPulse, Info, KeyRound, Minus, PiggyBank, Plus, ScanFace, SunMoon } from 'lucide-react';
import { AppShell, Logo, Sheet, fmt, toast, toastErr } from '@/ui/kit';
import { Gate } from '@/ui/Gate';
import { Avatar } from '@/ui/Avatar';
import { api, passkeyApprove, passkeyCreate, saveLimit } from '@/lib/client/api';
import { useBalances } from '@/lib/client/data';
import { refreshAll, setRules, useContacts, useProfile, useRules, useSession } from '@/lib/client/session';

declare global { interface Window { setTheme?: (p: string) => void } }
function Stepper({ v, set, step, min, max }: { v: number; set: (n: number) => void; step: number; min: number; max: number }) {
  return <div className="limv"><button className="stp" aria-label="Less" onClick={() => set(Math.max(min, v - step))}><Minus size={20} strokeWidth={2.4} aria-hidden /></button><span>${v.toLocaleString('en-US')}</span><button className="stp" aria-label="More" onClick={() => set(Math.min(max, v + step))}><Plus size={20} strokeWidth={2.4} aria-hidden /></button></div>;
}

type Credits = { used: number; total: number; left: number; resets: string; ai: boolean; stt: boolean; cost: { chat: number; voice: number } };
function CreditsMeter() {
  const rules = useRules();
  const [c, setC] = useState<Credits | null>(null);
  const [mem, setMem] = useState<{ id: string; text: string }[]>([]);
  useEffect(() => { api<Credits>('/api/credits').then(setC).catch(() => {}); api<{ items: { id: string; text: string }[] }>('/api/memory').then((r) => setMem(r.items || [])).catch(() => {}); }, []);
  const forget = async (id: string) => { try { await api('/api/memory', { delete: id }); setMem((m) => m.filter((x) => x.id !== id)); toast('Forgotten'); } catch (e) { toastErr(e); } };
  const pct = c ? Math.min(100, Math.round((c.used / Math.max(1, c.total)) * 100)) : 0;
  const reset = c ? new Date(c.resets).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
  return (<>
    <div className="ghead"><b>AI credits</b><span>Free plan</span></div>
    <section className="group">
      <div className="cell credits"><div className="lft"><span className="ic"><Sparkles size={17} aria-hidden /></span><div style={{ flex: 1, minWidth: 0 }}>
        <div className="ct">{c ? `${c.left.toLocaleString('en-US')} of ${c.total.toLocaleString('en-US')} left` : 'Loading credits'}</div>
        <div className="meter" role="progressbar" aria-label="AI credits used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: pct + '%' }} /></div>
        <div className="cs">{c ? `A chat reply uses about ${c.cost.chat}, a voice note about ${c.cost.voice}. Resets ${reset}. ${c.ai ? 'AI is on.' : 'AI is resting, so Pocket uses its built in helper for free.'}` : ' '}</div>
      </div></div></div>
      <button className="cell" onClick={() => setRules({ ...rules, speak: !rules.speak })}><div className="lft"><span className="ic"><Volume2 size={17} aria-hidden /></span><div><div className="ct">Read replies out loud</div><div className="cs">Uses your device voice, free</div></div></div><span className="toggle" role="switch" aria-checked={!!rules.speak} aria-label="Read replies out loud" /></button>
    </section>
    <div className="ghead"><b>What Pocket remembers</b><span>{mem.length}</span></div>
    <section className="group">
      {mem.length === 0 ? <div className="cell"><div className="lft"><span className="ic"><Brain size={17} aria-hidden /></span><div><div className="ct">Nothing yet</div><div className="cs">Tell Pocket things like &quot;I get paid on the 25th&quot; and it will remember</div></div></div></div>
        : mem.map((m) => <div className="cell" key={m.id}><div className="lft"><span className="ic"><Brain size={17} aria-hidden /></span><div className="ct" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{m.text}</div></div><button className="lnk" onClick={() => forget(m.id)}>Forget</button></div>)}
    </section>
  </>);
}
function SettingsInner() {
  const s = useSession()!; const p = useProfile(); const rules = useRules(); const contacts = useContacts();
  const b = useBalances();
  const serverLimit = b.data?.limit ?? rules.limit; const used = b.data?.usedToday ?? 0;
  const [sheet, setSheet] = useState<'' | 'limit' | 'keep' | 'network'>('');
  const [lim, setLim] = useState(serverLimit); const [keep, setKeep] = useState(rules.keep);
  const [busy, setBusy] = useState(false);
  const [pref, setPref] = useState('system'); const [eff, setEff] = useState('light');
  useEffect(() => { const f = () => { setPref(document.documentElement.dataset.pref || 'system'); setEff(document.documentElement.dataset.theme || 'light'); }; f(); document.addEventListener('themechange', f); const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener('change', f); return () => { document.removeEventListener('themechange', f); mq.removeEventListener('change', f); }; }, []);
  useEffect(() => { if (sheet === 'limit') setLim(serverLimit); if (sheet === 'keep') setKeep(rules.keep); }, [sheet]); // eslint-disable-line react-hooks/exhaustive-deps
  const raising = lim > serverLimit;
  const saveLim = async () => {
    setBusy(true);
    try { if (raising && rules.passkey) await passkeyApprove(rules.passkeyId); await saveLimit(lim); refreshAll(); toast(`Daily limit is now $${lim.toLocaleString('en-US')}`); setSheet(''); }
    catch (e) { toastErr(e); } finally { setBusy(false); }
  };
  const togglePk = async () => {
    try {
      if (rules.passkey) { await passkeyApprove(rules.passkeyId); setRules({ passkey: false, passkeyId: undefined }); toast('Passkey approval is off'); }
      else { const id = await passkeyCreate(s.username); setRules({ passkey: true, passkeyId: id }); toast('Passkey approval is on'); }
    } catch (e) { toastErr(e); }
  };
  const cell = (Ic: typeof Gauge, t: string, v: React.ReactNode, on: () => void) => <button className="cell" onClick={on}><div className="lft"><span className="ic"><Ic size={17} aria-hidden /></span><div className="ct">{t}</div></div><span className="cv">{v} <ChevronRight size={16} aria-hidden /></span></button>;
  return (
    <AppShell screen="settings" tab="wallet" side="settings" overlay={<>
      <Sheet open={sheet === 'limit'} onClose={() => setSheet('')} label="Daily send limit"><div className="sh-t">Daily send limit</div><div className="sh-s">The most Pocket can send for you in one day. The server checks it on every send.</div>
        <Stepper v={lim} set={setLim} step={50} min={0} max={5000} />
        <div className="quick">{[100, 200, 300, 500, 1000].map((a) => <button key={a} className={a === lim ? 'on' : ''} onClick={() => setLim(a)}>${a.toLocaleString('en-US')}</button>)}</div>
        <div style={{ margin: '1rem .1rem .2rem' }}><div className="usebar"><i style={{ width: Math.min(100, lim ? (used / lim) * 100 : 100) + '%' }} /></div><div className="uselab"><span>Used today ${fmt(used)}</span><span>Resets at midnight UTC</span></div></div>
        <div className="note2" style={{ margin: '.6rem 0 .9rem' }}><KeyRound size={16} aria-hidden /><span>{raising ? (rules.passkey ? 'Raising it asks for your passkey, then your device key signs the change.' : 'Your device key signs the change. Turn on passkey approval for an extra check.') : 'Lowering it is signed by your device key. No passkey needed.'}</span></div>
        <button className="btn big" disabled={busy || lim === serverLimit} onClick={saveLim}>{busy ? 'Saving…' : 'Save'}</button></Sheet>
      <Sheet open={sheet === 'keep'} onClose={() => setSheet('')} label="Always keep"><div className="sh-t">Always keep</div><div className="sh-s">Pocket never lets a plan take you below this. The blocked screen in Chat uses it.</div>
        <Stepper v={keep} set={setKeep} step={10} min={0} max={10000} />
        <div className="quick">{[0, 50, 100, 200, 500].map((a) => <button key={a} className={a === keep ? 'on' : ''} onClick={() => setKeep(a)}>${a}</button>)}</div>
        <button className="btn big" style={{ marginTop: '.9rem' }} onClick={() => { setRules({ keep }); toast(keep ? `Pocket keeps $${keep} for you` : 'Keep rule is off'); setSheet(''); }}>Done</button></Sheet>
      <Sheet open={sheet === 'network'} onClose={() => setSheet('')} label="Network"><div className="sh-t">Network</div><div className="sh-s">Pocket is a testnet app. Nothing real moves.</div>
        <section className="group"><div className="opt sel on"><span className="logo near"><Logo name="near" /></span><span className="lft2"><span className="ot">NEAR testnet <span className="lv">Live</span></span><span className="os">Test dollars and paper stocks</span></span><span className="rd"><Check size={14} strokeWidth={3} aria-hidden /></span></div>
          <div className="opt dis"><span className="logo near"><Logo name="near" /></span><span className="lft2"><span className="ot">NEAR mainnet <span className="rm">Later</span></span><span className="os">Real money. Not offered in this version</span></span><span className="rd" /></div></section>
        <button className="btn big" style={{ marginTop: '.9rem' }} onClick={() => setSheet('')}>Done</button></Sheet>
    </>}>
      <header className="nav large"><div className="lt">Settings</div></header>
      <main className="body settings">
        <section className="group"><Link className="cell" href="/profile"><div className="lft"><Avatar size={48} cls="me-av" /><div><div className="ct" style={{ fontWeight: 600 }}>{p.name || '@' + s.username}</div><div className="cs">@{s.username}, {s.account}</div></div></div><span className="chev"><ChevronRight size={18} aria-hidden /></span></Link></section>
        <div className="ghead"><b>Safety</b></div>
        <section className="group">
          {cell(Gauge, 'Daily send limit', <span>${serverLimit.toLocaleString('en-US')}</span>, () => setSheet('limit'))}
          {cell(PiggyBank, 'Always keep', rules.keep ? `$${rules.keep.toLocaleString('en-US')}` : 'Off', () => setSheet('keep'))}
          <button className="cell" onClick={togglePk}><div className="lft"><span className="ic"><ScanFace size={17} aria-hidden /></span><div><div className="ct">Approve with passkey</div><div className="cs">Face, fingerprint or screen lock on this device</div></div></div><span className="toggle" role="switch" aria-checked={rules.passkey} aria-label="Approve with passkey" /></button>
        </section>
        <CreditsMeter />
        <div className="ghead"><b>Sending</b></div>
        <section className="group"><Link className="cell" href="/contacts"><div className="lft"><span className="ic"><BookUser size={17} aria-hidden /></span><div className="ct">Contacts and saved addresses</div></div><span className="cv">{contacts.length} <ChevronRight size={16} aria-hidden /></span></Link>{cell(Globe, 'Network', 'NEAR testnet', () => setSheet('network'))}</section>
        <div className="ghead"><b>Appearance</b><span>Showing {eff === 'black' ? 'black' : 'light'}</span></div>
        <section className="group"><div className="opt3" role="radiogroup" aria-label="Theme">
          {([['light', 'Light', 'l'], ['black', 'Black', 'k'], ['system', 'System', 's']] as const).map(([v, l, c]) => <button key={v} role="radio" aria-checked={pref === v} onClick={() => window.setTheme?.(v)}><span className={'pv ' + c}><i /><i /><i /><b /></span><span>{l}</span><span className="rad"><Check size={14} strokeWidth={3} aria-hidden /></span></button>)}
        </div><div className="cell"><div className="lft"><span className="ic"><SunMoon size={17} aria-hidden /></span><div className="ct">System follows your device</div></div><span className="cs">{pref === 'system' ? `Now ${eff === 'black' ? 'black' : 'light'}` : 'Off'}</span></div></section>
        <div className="ghead"><b>About</b></div>
        <section className="group">
          <a className="cell" href="/api/health" target="_blank" rel="noreferrer"><div className="lft"><span className="ic"><HeartPulse size={17} aria-hidden /></span><div className="ct">Contracts and health</div></div><span className="cv">Open <ChevronRight size={16} aria-hidden /></span></a>
          <a className="cell" href="https://github.com/henrysammarfo/pocket/tree/main" target="_blank" rel="noreferrer"><div className="lft"><span className="ic"><Info size={17} aria-hidden /></span><div className="ct">Source code</div></div><span className="cv">GitHub <ChevronRight size={16} aria-hidden /></span></a>
        </section>
        <div className="srcline"><Info size={14} aria-hidden /><span>Testnet only. Your key lives in this browser. Back it up from Profile.</span></div>
      </main>
    </AppShell>
  );
}
export default function Page() { return <Gate><SettingsInner /></Gate>; }
