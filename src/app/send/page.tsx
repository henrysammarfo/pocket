'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { AppShell, Brand, fmt } from '@/ui/kit';
import { Gate } from '@/ui/Gate';
import { Avatar } from '@/ui/Avatar';
import { Keypad, press } from '@/ui/Keypad';
import { summary, useBalances, useQuotes } from '@/lib/client/data';
import { useRules } from '@/lib/client/session';
import Link from 'next/link';

function SendInner() {
  const b = useBalances(); const q = useQuotes(); const sm = summary(b.data, q.data);
  const rules = useRules();
  const [v, setV] = useState('');
  const router = useRouter();
  const n = Number(v || 0);
  const avail = Math.max(0, sm.pusd - rules.keep);
  const left = Math.max(0, (b.data?.limit ?? rules.limit) - (b.data?.usedToday ?? 0));
  const err = n > avail ? `You have $${fmt(avail)} to send${rules.keep ? ` after keeping $${fmt(rules.keep)}` : ''}.` : n > left ? `That is over your daily limit. $${fmt(left)} left today.` : '';
  useEffect(() => { const k = (e: KeyboardEvent) => { if (/^[0-9.]$/.test(e.key)) setV((x) => press(x, e.key)); else if (e.key === 'Backspace') setV((x) => press(x, 'del')); else if (e.key === 'Enter' && n > 0 && !err) router.push('/send/to?amt=' + n); }; addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [n, err, router]);
  const [w, c] = (v || '0').split('.');
  return (
    <AppShell screen="send" tab="send">
      <header className="nav"><Link className="nb" href="/contacts" aria-label="Contacts" style={{ fontSize: '.9375rem', fontWeight: 600, width: 'auto' }}>Contacts</Link><Brand /><Link href="/profile" aria-label="Profile"><Avatar size={36} cls="me-av" /></Link></header>
      <main className="body send">
        <div className="amtwrap">
          <div className={'amt' + (err ? ' over' : '')} aria-live="polite"><span className="cur">$</span>{Number(w).toLocaleString('en-US')}{v.includes('.') ? '.' + (c || '') : ''}</div>
          <div className="bal"><Wallet size={15} aria-hidden />Balance <b>{fmt(sm.pusd)}</b> pUSD</div>
          {err && <div className="errline" role="alert" style={{ marginTop: '.4rem' }}>{err}</div>}
        </div>
        <div className="quick">{[10, 20, 50].map((x) => <button key={x} onClick={() => setV(String(x))}>${x}</button>)}<button onClick={() => setV(String(Math.floor(Math.min(avail, left) * 100) / 100))}>Max</button></div>
        <Keypad onKey={(k) => setV((x) => press(x, k))} />
        <div className="cta"><button className="btn big" disabled={!(n > 0) || !!err} onClick={() => router.push('/send/to?amt=' + n)}>Choose who</button></div>
      </main>
    </AppShell>
  );
}
export default function Page() { return <Gate><SendInner /></Gate>; }
