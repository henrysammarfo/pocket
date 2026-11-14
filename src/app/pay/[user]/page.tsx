'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell, Brand } from '@/ui/kit';
import { AvatarFor } from '@/ui/Avatar';
import { useSession } from '@/lib/client/session';
import { ROOT } from '@/lib/shared/deployment';

export default function Page({ params }: { params: Promise<{ user: string }> }) {
  const { user } = use(params);
  const u = decodeURIComponent(user).replace(/^@/, '').toLowerCase();
  const s = useSession();
  const [st, setSt] = useState<'load' | 'ok' | 'no'>('load');
  useEffect(() => { fetch('/api/account/lookup?q=' + encodeURIComponent(u)).then((r) => r.json()).then((j) => setSt(j.exists && j.pocket ? 'ok' : 'no')).catch(() => setSt('no')); }, [u]);
  return (
    <AppShell screen="pay" tab="send" noTabs>
      <header className="nav"><span className="nb" /><Brand /><span className="nb" /></header>
      <main className="body" style={{ alignItems: 'center', textAlign: 'center', gap: '1rem', paddingTop: '2rem' }}>
        <AvatarFor value="" name={u} size={88} />
        <div className="lt">@{u}</div>
        <div className="cs mono">{u}.{ROOT}</div>
        {st === 'load' && <div className="skel" style={{ height: '3rem', width: '100%' }} />}
        {st === 'no' && <div className="empty">There is no Pocket user called @{u}.</div>}
        {st === 'ok' && (s ? (s.username === u ? <div className="empty">This is your pay link. Share it so people can send to you.</div> : <Link className="btn big" style={{ width: '100%' }} href={`/send/to?to=@${u}`}>Pay @{u}</Link>)
          : <><Link className="btn big" style={{ width: '100%' }} href={`/welcome?next=${encodeURIComponent('/send/to?to=@' + u)}`}>Create a Pocket to pay @{u}</Link><div className="fine">Free, takes a few seconds, and you get 1,000 test dollars. NEAR testnet only.</div></>)}
      </main>
    </AppShell>
  );
}
