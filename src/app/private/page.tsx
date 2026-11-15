'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, EyeOff, Shield } from 'lucide-react';
import { AppShell } from '@/ui/kit';
import { Gate } from '@/ui/Gate';
import { useSession } from '@/lib/client/session';
import { POOL, POOL_NOTE_NEAR, accountUrl, txUrl } from '@/lib/shared/deployment';
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
  if (!privateReady()) return <AppShell screen="private" tab="wallet"><main className="body"><p>The private pool is not set up on this deployment.</p></main></AppShell>;
  return (
    <AppShell screen="private" tab="wallet">
      <header className="nav"><Link className="nb" href="/wallet" aria-label="Back"><ChevronLeft size={22} aria-hidden /></Link><div className="tt">Private balance</div><span style={{ width: 36 }} /></header>
      <main className="body" style={{ display: 'grid', gap: '1rem', paddingBottom: '2rem' }}>
        <section className="pcard" aria-label="Private balance" style={{ aspectRatio: 'auto', maxHeight: 'none', gap: '.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}><EyeOff size={18} aria-hidden /> <b>Private balance</b></div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }} data-testid="private-balance">{bal ? bal.near : '…'} NEAR</div>
          <div style={{ opacity: .8 }}>{bal ? `${bal.count} note${bal.count === 1 ? '' : 's'} of ${POOL_NOTE_NEAR} NEAR, kept only on this device` : 'Checking the pool…'}</div>
        </section>
        {v3 === false && <div role="note" className="errline" data-testid="needs-v3">Adding to a private balance needs the newer Pocket wallet (version 3). Your account runs an older version, so this button is off. You can still receive private sends.</div>}
        <button className="btn big" disabled={!!busy || !v3} onClick={() => run('add', addToPrivate, `${POOL_NOTE_NEAR} NEAR moved into your private balance. Your limits counted it.`)}>{busy === 'add' ? 'Moving…' : `Add ${POOL_NOTE_NEAR} NEAR to private balance`}</button>
        <section style={{ display: 'grid', gap: '.5rem' }}>
          <label htmlFor="pto"><b>Private send</b> {POOL_NOTE_NEAR} NEAR to</label>
          <label className="field"><input id="pto" className="inp" placeholder="name.testnet or an account address" value={to} onChange={(e) => setTo(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
          <button className="btn" disabled={!!busy || !toOk || !bal?.count} onClick={() => run('send', () => privateSend(to.trim()), `Sent ${POOL_NOTE_NEAR} NEAR privately. The chain shows the pool paying ${to.trim()}, not you.`)}>{busy === 'send' ? 'Making the proof on this phone…' : 'Private send'}</button>
        </section>
        {msg && <div data-testid="pmsg" role={msg.err ? 'alert' : 'status'} className={msg.err ? 'errline' : ''}>{msg.text} {msg.hash && <a href={txUrl(msg.hash)} target="_blank" rel="noreferrer">See it on NearBlocks</a>}</div>}
        <section aria-label="What is hidden" style={{ fontSize: '.9rem', lineHeight: 1.45 }}>
          <h3 style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}><Shield size={16} aria-hidden /> What this hides, and what it does not</h3>
          <ul>
            <li>Hidden: which deposit paid which receiver. The receiver is paid by the pool, with a zero knowledge proof that some note is theirs to spend, and Pocket&apos;s relayer pays the gas.</li>
            <li>Hidden: your private balance. It is notes on this device, not a number on chain.</li>
            <li>Not hidden: that your account put {POOL_NOTE_NEAR} NEAR into the pool, and that the receiver got {POOL_NOTE_NEAR} NEAR from it. Every note is the same size, so amounts do not link them.</li>
            <li>Your crowd is everyone who used the pool. On testnet that is small, so timing can still link a deposit and a send. Wait before sending.</li>
            <li>Your limits still apply: money enters the pool only through your wallet contract&apos;s per send and 24 hour caps.</li>
            <li>Keep this device or export your notes. Anyone with them can spend them, and Pocket cannot restore them.</li>
          </ul>
          <p>Pool contract: <a href={accountUrl(POOL)} target="_blank" rel="noreferrer">{POOL}</a></p>
          <button className="btn ghost" onClick={() => { navigator.clipboard?.writeText(exportNotes(s.account)); setMsg({ text: 'Notes copied. Keep them somewhere safe.' }); }}>Copy my notes</button>
        </section>
      </main>
    </AppShell>
  );
}
export default function Page() { return <Gate><PrivateInner /></Gate>; }
