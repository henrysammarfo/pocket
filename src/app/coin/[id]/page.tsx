'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowDownUp, ArrowUpRight, Info, Plus, ShieldCheck } from 'lucide-react';
import { AppShell, BackNav, Chart, Chg, Logo, Money, RANGE_WORD, Ranges, fmt } from '@/ui/kit';
import { Gate } from '@/ui/Gate';
import { AddSheet, ReceiveSheet } from '@/ui/sheets';
import { ActivityRow, useActivity } from '@/ui/Activity';
import { ago, summary, useBalances, useQuotes } from '@/lib/client/data';
import { useSession } from '@/lib/client/session';
import { USDC } from '@/lib/shared/deployment';

function CoinInner({ id }: { id: string }) {
  const U = id === 'usdc';
  const s = useSession()!;
  const b = useBalances(); const q = useQuotes(); const sm = summary(b.data, q.data);
  const [range, setRange] = useState('1D');
  const [d, setD] = useState<{ ranges: Record<string, number[]> } | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const [sheet, setSheet] = useState<'' | 'recv' | 'add'>('');
  const act = useActivity();
  useEffect(() => { if (!U) fetch('/api/coin?id=near').then((r) => r.json()).then(setD).catch(() => setD(null)); }, [U]);
  const t = q.data?.tokens[U ? 'USDC' : 'NEAR'];
  const bal = U ? sm.usdc : sm.near;
  const usd = U ? sm.usdc * (t?.price || 1) : sm.nearUsd;
  const pts = d && t ? [...(d.ranges[range] || []), t.price] : null;
  const base = pts?.[0] || 0;
  const price = scrub ?? t?.price ?? 0;
  const items = act.items.filter((a) => (a.data as { token?: string }).token === (U ? 'USDC' : 'NEAR') || (!U && a.kind === 'signup'));
  return (
    <AppShell screen="coin" tab="wallet" overlay={<><ReceiveSheet open={sheet === 'recv'} onClose={() => setSheet('')} /><AddSheet open={sheet === 'add'} onClose={() => setSheet('')} /></>}>
      <BackNav href="/wallet" title={U ? 'USDC' : 'NEAR'} />
      <main className="body coin">
        <div className="dhead"><span className={'logo ' + (U ? 'usdc' : 'near')}><Logo name={U ? 'usdc' : 'near'} /></span><div><div className="nm">{U ? 'USD Coin' : 'NEAR'}</div><div className="sb">{t ? '$' + fmt(price, U ? 4 : 2) + ' each' : '\u00a0'}</div></div></div>
        <div><div className="pc-lab" style={{ color: 'var(--ink-2)' }}>Your balance</div><div className="bigp">{b.data ? <Money v={usd} /> : <span className="skel" style={{ display: 'inline-block', width: '8rem', height: '2.4rem' }} />}</div><div className="sb" style={{ color: 'var(--ink-2)', fontSize: '.9375rem' }}>{fmt(bal, U ? 2 : 4)} {U ? 'USDC' : 'NEAR'}</div></div>
        <div className="acts4">
          <Link href={`/send/to?asset=${U ? 'USDC' : 'NEAR'}`}><span className="ci"><ArrowUpRight size={22} strokeWidth={2.2} aria-hidden /></span>Send</Link>
          <button onClick={() => setSheet('recv')}><span className="ci"><ArrowDownLeft size={22} strokeWidth={2.2} aria-hidden /></span>Receive</button>
          <Link href="/swap"><span className="ci"><ArrowDownUp size={22} strokeWidth={2.2} aria-hidden /></span>Swap</Link>
          <button onClick={() => setSheet('add')}><span className="ci"><Plus size={22} strokeWidth={2.2} aria-hidden /></span>Add</button>
        </div>
        {U ? <div className="note2"><ShieldCheck size={18} aria-hidden /><span>{t ? `Pegged to 1 dollar. Now $${fmt(t.price, 4)}.` : 'Pegged to 1 dollar.'}</span></div> : <>
          {t && base ? <Chg d={price - base} base={base} when={RANGE_WORD[range]} /> : <span className="chg">&nbsp;</span>}
          <Chart pts={pts} base={base || undefined} onScrub={setScrub} fmtV={(v) => '$' + fmt(v, 3)} />
          <Ranges value={range} onChange={setRange} />
        </>}
        <div className="ghead"><b>Networks you hold it on</b></div>
        <section className="group list">
          <div className="row"><span className="logo near"><Logo name="near" /></span><span className="rn"><span className="nm">NEAR testnet</span><span className="sb">{s.account}</span></span><span className="px"><span className="p">{fmt(bal, U ? 2 : 4)}</span><span className="lv">Live</span></span></div>
          {U && <>
            <div className="row"><span className="logo sol"><Logo name="solana" /></span><span className="rn"><span className="nm">Solana devnet</span><span className="sb">Send out only, via a bridge</span></span><span className="px"><span className="p">0.00</span><span className="rm">Roadmap</span></span></div>
            <div className="row"><span className="logo eth"><Logo name="ethereum" /></span><span className="rn"><span className="nm">Ethereum Sepolia</span><span className="sb">Send out only, via a bridge</span></span><span className="px"><span className="p">0.00</span><span className="rm">Roadmap</span></span></div>
          </>}
        </section>
        <div className="ghead"><b>About</b></div>
        <section className="group"><div className="about">{U ? <>USDC is a digital dollar issued by Circle. On NEAR it is native, not bridged. Testnet contract <span className="mono">{USDC.slice(0, 4)}…{USDC.slice(-4)}</span>. Get some free at faucet.circle.com.</> : 'NEAR is the coin of the NEAR network. Pocket keeps a little in your account for storage. Pocket pays the gas for your sends.'}</div></section>
        <div className="ghead"><b>Activity</b></div>
        <section className="group list">{items.length ? items.slice(0, 6).map((a) => <ActivityRow key={a.kind + a.tx} a={a} />) : <div className="empty">No {U ? 'USDC' : 'NEAR'} activity yet.</div>}</section>
        <div className="srcline"><Info size={14} aria-hidden /><span>{t ? `Price: CoinGecko, ${ago(t.updatedAt)}.` : 'Loading price'}{!U ? ' Charts: CoinGecko market chart.' : ''}</span></div>
      </main>
    </AppShell>
  );
}
export default function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = use(params); return <Gate><CoinInner id={id === 'near' ? 'near' : 'usdc'} /></Gate>; }
