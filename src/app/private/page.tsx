'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, EyeOff, Shield } from 'lucide-react';
import { AppShell } from '@/ui/kit';
import { Gate } from '@/ui/Gate';
import { useSession } from '@/lib/client/session';
import { POOL_NOTE_NEAR } from '@/lib/shared/deployment';
import { addToPrivate, exportNotes, privateBalance, privateReady, privateSend, walletHasPool } from '@/lib/client/private';
import { validAccountId } from '@/lib/shared/policy';

function PrivateInner() {
  const s = useSession()!;
  const [bal, setBal] = useState<{ near: string; count: number } | null>(null);
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ text: string; hash?: string; err?: boolean } | null>(null);
  const [v3, setV3] = useState<boolean | null>(null);
  useEffect(() => { walletHasPool(s.account).then(setV3); }, [s.account]);
  const load = useCallback(() => { if (privateReady()) privateBalance(s.account).then((b) => setBal({ near: b.near, count: b.notes.length })).catch(() => setBal({ near: '0.0', count: 0 })); }, [s.account]);
  useEffect(load, [load]);
  const run = async (what: string, f: () => Promise<{ hash: string }>, ok: string) => {
    setBusy(what); setMsg(null);
    try { const r = await f(); setMsg({ text: ok, hash: r.hash }); load(); } catch (e) { setMsg({ text: (e as Error).message, err: true }); } finally { setBusy(''); }
  };
  const toOk = validAccountId(to.trim());
  if (!privateReady()) return <AppShell screen="private" tab="wallet"><main className="body"><p>Hidden balance is not available here yet.</p></main></AppShell>;
  return (
    <AppShell screen="private" tab="wallet">
      <header className="nav"><Link className="nb" href="/wallet" aria-label="Back"><ChevronLeft size={22} aria-hidden /></Link><div className="tt">Hidden balance</div><span style={{ width: 36 }} /></header>
      <main className="body" style={{ display: 'grid', gap: '1rem', paddingBottom: '2rem' }}>
        <section className="pcard" aria-label="Hidden balance" style={{ aspectRatio: 'auto', maxHeight: 'none', gap: '.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}><EyeOff size={18} aria-hidden /> <b>Hidden balance</b></div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }} data-testid="private-balance">{bal ? bal.near : '…'} NEAR</div>
          <div style={{ opacity: .8 }}>{bal ? 'Only you can see this. It is saved on this device.' : 'Checking…'}</div>
        </section>
        {v3 === false && <div role="note" className="errline" data-testid="needs-v3">Hiding money is not ready on your account yet. Your normal sends still work, and people can still send to you privately.</div>}
        <button className="btn big" disabled={!!busy || !v3} onClick={() => run('add', addToPrivate, `${POOL_NOTE_NEAR} NEAR is now hidden. It counted toward your daily limit.`)}>{busy === 'add' ? 'Hiding…' : `Hide ${POOL_NOTE_NEAR} NEAR`}</button>
        <section style={{ display: 'grid', gap: '.5rem' }}>
          <label htmlFor="pto"><b>Send privately</b> {POOL_NOTE_NEAR} NEAR to</label>
          <label className="field"><input id="pto" className="inp" placeholder="Their Pocket account, like ama.pocket" value={to} onChange={(e) => setTo(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
          <button className="btn" disabled={!!busy || !toOk || !bal?.count} onClick={() => run('send', () => privateSend(to.trim()), `Sent ${POOL_NOTE_NEAR} NEAR privately to ${to.trim()}.`)}>{busy === 'send' ? 'Sending privately…' : 'Send privately'}</button>
          <div className="fine">You can also turn on Send privately when you send 0.1 NEAR from the <Link href="/send">Send</Link> screen.</div>
        </section>
        {msg && <div data-testid="pmsg" role={msg.err ? 'alert' : 'status'} className={msg.err ? 'errline' : ''}>{msg.text} {msg.hash && <a href={`/r/${msg.hash}`}>See receipt</a>}</div>}
        <section aria-label="What stays private" style={{ fontSize: '.9rem', lineHeight: 1.45 }}>
          <h3 style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}><Shield size={16} aria-hidden /> What stays private</h3>
          <ul>
            <li>Private: who you paid. They get the money from Pocket&apos;s shared private fund, not from you.</li>
            <li>Private: your hidden balance. Only this device knows it.</li>
            <li>Not private: that you hid {POOL_NOTE_NEAR} NEAR, and that they got {POOL_NOTE_NEAR} NEAR. Every private send is the same size.</li>
            <li>Few people use it yet, so sending right after hiding is easier to guess. Waiting a while helps.</li>
            <li>Your daily limit still applies to money you hide.</li>
            <li>Keep this device or copy your backup. Anyone with the backup can spend it, and Pocket cannot get it back for you.</li>
          </ul>
          <p><a href="https://github.com/henrysammarfo/pocket/blob/private-pool/README.md#private-pool-branch-private-pool" target="_blank" rel="noreferrer">How it works</a></p>
          <button className="btn ghost" onClick={() => { navigator.clipboard?.writeText(exportNotes(s.account)); setMsg({ text: 'Backup copied. Keep it somewhere safe.' }); }}>Copy my backup</button>
        </section>
      </main>
    </AppShell>
  );
}
export default function Page() { return <Gate><PrivateInner /></Gate>; }
