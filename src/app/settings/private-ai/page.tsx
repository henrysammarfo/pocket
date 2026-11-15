'use client';
// Settings > Private AI: runs a fresh TEE attestation check of every NEAR AI Cloud model Pocket uses
// (new random nonce per model) and shows each check as PASS or FAIL. The check runs in this browser,
// straight against NEAR AI Cloud, so it does not depend on Pocket's server; /api/attest is the fallback.
import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronRight, Cpu, ExternalLink, FileText, Info, Mic, MessageSquareText, Receipt, RefreshCw, ShieldAlert, ShieldCheck, Smartphone, X } from 'lucide-react';
import { AppShell, BackNav } from '@/ui/kit';
import { Gate } from '@/ui/Gate';
import { attestAll } from '@/lib/shared/attest';
import './verified.css';

type Chk = { id: string; label: string; ok: boolean; detail?: string };
type ModelReport = { role: 'chat' | 'vision' | 'voice'; title: string; model: string; ok: boolean; instances: number; signer?: string; checks: Chk[]; error?: string; ms: number };
type Report = { ok: boolean; provider: string; checkedAt: string; models: ModelReport[]; notChecked: string; verifyUrl: string };

const ICON = { chat: MessageSquareText, vision: Receipt, voice: Mic } as const;
const PLACEHOLDER: Pick<ModelReport, 'role' | 'title'>[] = [{ role: 'chat', title: 'Chat and plans' }, { role: 'vision', title: 'Receipts and bills' }, { role: 'voice', title: 'Voice notes' }];
const short = (a?: string) => (a ? a.slice(0, 6) + '…' + a.slice(-4) : '');

function Row({ c }: { c: Chk }) {
  return (
    <div className="vrow">
      <span className={'vic ' + (c.ok ? 'ok' : 'bad')}>{c.ok ? <Check size={14} strokeWidth={3} aria-hidden /> : <X size={14} strokeWidth={3} aria-hidden />}</span>
      <div className="vtx"><div className="vl">{c.label}</div>{c.detail && <div className="vd">{c.detail}</div>}</div>
      <span className={'vst ' + (c.ok ? 'ok' : 'bad')}>{c.ok ? 'PASS' : 'FAIL'}</span>
    </div>
  );
}

function Inner() {
  const [r, setR] = useState<Report | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');
  const [where, setWhere] = useState<'browser' | 'server' | ''>('');
  const run = useCallback(async () => {
    setBusy(true); setErr('');
    try {
      // Model names come from Pocket's health page; the evidence comes straight from NEAR AI Cloud.
      const h = await fetch('/api/health', { cache: 'no-store' }).then((x) => x.json()).catch(() => ({}));
      const list = [
        { role: 'chat' as const, title: 'Chat and plans', model: h.aiModel || 'Qwen/Qwen3.6-35B-A3B-FP8' },
        { role: 'vision' as const, title: 'Receipts and bills', model: h.visionModel || 'Qwen/Qwen3-VL-30B-A3B-Instruct' },
        { role: 'voice' as const, title: 'Voice notes', model: h.sttModel || 'openai/whisper-large-v3' },
      ];
      const mine = await attestAll(list);
      if (mine.models.some((m) => m.instances > 0)) { setR(mine); setWhere('browser'); return; }
      const res = await fetch('/api/attest', { cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || 'The check could not run.');
      setR(j); setWhere('server');
    } catch (e) { setErr(e instanceof Error ? e.message : 'The check could not run.'); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { run(); }, [run]);

  const passed = r ? r.models.reduce((n, m) => n + m.checks.filter((c) => c.ok).length, 0) : 0;
  const total = r ? r.models.reduce((n, m) => n + Math.max(m.checks.length, 1), 0) : 0;
  const state = busy ? 'wait' : r?.ok ? 'ok' : 'bad';
  const when = r ? new Date(r.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '';

  return (
    <AppShell screen="settings" tab="wallet" side="settings" cls="vf">
      <BackNav href="/settings" title="Private AI" />
      <main className="body settings">
        <section className="vhero" aria-live="polite">
          <span className={'vbadge ' + state}>{state === 'bad' ? <ShieldAlert size={34} strokeWidth={1.8} aria-hidden /> : <ShieldCheck size={34} strokeWidth={1.8} aria-hidden />}</span>
          <div className="vtitle">{busy ? 'Checking the hardware' : r?.ok ? 'Verified' : err ? 'Check did not run' : 'Not verified'}</div>
          <div className="vsub">{busy ? 'Asking NEAR AI Cloud for fresh evidence with a new random number.' : r?.ok ? 'Your chats, photos and voice notes are processed inside secure hardware that even the host cannot read.' : err || 'One or more checks failed. Pocket switches to its backup AI when NEAR AI is not available.'}</div>
          {!busy && r && <div className="vmeta"><span className={'vpill ' + (r.ok ? 'ok' : 'bad')}>{passed} of {total} checks passed</span><span className="vpill">Checked {when}</span><span className="vpill" data-testid="attest-where">{where === 'browser' ? 'Checked by your browser' : 'Checked by Pocket\'s server'}</span></div>}
        </section>

        {(r?.models || PLACEHOLDER).map((m) => {
          const full = 'model' in m ? (m as ModelReport) : null;
          const Ic = ICON[m.role];
          return (
            <div key={m.role}>
              <div className="ghead"><b style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}><Ic size={16} aria-hidden />{m.title}</b>{full && <span className="vmodel">{full.model}</span>}</div>
              <section className="group">
                {busy || !full ? [0, 1, 2].map((i) => <div className="vrow" key={i}><span className="vic wait" /><div className="vtx"><div className="vskel" /><div className="vskel s" /></div><span className="vst wait">…</span></div>)
                  : full.error ? <Row c={{ id: 'err', label: 'Could not get attestation', ok: false, detail: full.error }} />
                  : full.checks.map((c) => <Row key={c.id} c={c} />)}
                {!busy && full && !full.error && <div className="vrow"><span className="vic wait"><Cpu size={13} aria-hidden /></span><div className="vtx"><div className="vd">{full.instances} attested instance{full.instances === 1 ? '' : 's'}{full.signer ? ` · signing key ${short(full.signer)}` : ''} · {(full.ms / 1000).toFixed(1)} s</div></div></div>}
              </section>
            </div>
          );
        })}

        <button className="btn big vagain" onClick={run} disabled={busy}><RefreshCw size={18} className={busy ? 'spin' : ''} aria-hidden />{busy ? 'Checking…' : 'Check again'}</button>

        <div className="ghead"><b>What stays private</b></div>
        <section className="group">
          <div className="cell"><div className="lft"><span className="ic"><Smartphone size={17} aria-hidden /></span><div style={{ minWidth: 0 }}><div className="ct">Your chats stay on this device</div><div className="cs">Pocket&apos;s server keeps no chat text. Only memories you ask Pocket to keep are saved, and you can forget them in Settings.</div></div></div></div>
          <div className="cell"><div className="lft"><span className="ic"><ShieldCheck size={17} aria-hidden /></span><div style={{ minWidth: 0 }}><div className="ct">Backup AI is not private</div><div className="cs">If NEAR AI is down or at today&apos;s spend cap, Pocket uses Groq so the app keeps working.</div></div></div></div>
        </section>

        <div className="ghead"><b>Check it yourself</b></div>
        <section className="group">
          <a className="cell" href={r?.verifyUrl || 'https://cloud.near.ai/verify'} target="_blank" rel="noreferrer"><div className="lft"><span className="ic"><ShieldCheck size={17} aria-hidden /></span><div style={{ minWidth: 0 }}><div className="ct">NEAR AI Verification Center</div><div className="cs">Intel and NVIDIA certificate chains</div></div></div><span className="cv"><ExternalLink size={16} aria-hidden /></span></a>
          <a className="cell" href="/api/attest" target="_blank" rel="noreferrer"><div className="lft"><span className="ic"><FileText size={17} aria-hidden /></span><div className="ct">Raw result (JSON)</div></div><span className="cv"><ChevronRight size={16} aria-hidden /></span></a>
          <a className="cell" href="https://docs.near.ai/cloud/verification" target="_blank" rel="noreferrer"><div className="lft"><span className="ic"><Info size={17} aria-hidden /></span><div className="ct">How verification works</div></div><span className="cv"><ExternalLink size={16} aria-hidden /></span></a>
        </section>
        <div className="srcline"><Info size={14} aria-hidden /><span>{r?.notChecked || 'Intel and NVIDIA certificate chains are verified by NEAR AI.'} Developers can run the same checks with npm run verify:tee.</span></div>
      </main>
    </AppShell>
  );
}
export default function Page() { return <Gate><Inner /></Gate>; }
