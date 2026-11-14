'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowDownUp, ArrowUpRight, ChartLine, ChevronRight, Copy, Plus, Settings } from 'lucide-react';
import { AppShell, Coil, Logo, Money, fmt } from '@/ui/kit';
import { AddSheet, ReceiveSheet, copy } from '@/ui/sheets';
import { Gate } from '@/ui/Gate';
import { Avatar } from '@/ui/Avatar';
import { ActivityList } from '@/ui/Activity';
import { summary, useBalances, useQuotes } from '@/lib/client/data';
import { useSession } from '@/lib/client/session';
import { STOCKS } from '@/lib/shared/deployment';

function WalletInner() {
  const s = useSession()!;
  const b = useBalances(); const q = useQuotes();
  const sm = summary(b.data, q.data);
  const [sheet, setSheet] = useState<'' | 'recv' | 'add'>('');
  const held = STOCKS.filter((x) => sm.holdings[x.ticker] > 0).length;
  const ready = !!b.data;
  return (
    <AppShell screen="wallet" tab="wallet" overlay={<><ReceiveSheet open={sheet === 'recv'} onClose={() => setSheet('')} /><AddSheet open={sheet === 'add'} onClose={() => setSheet('')} /></>}>
      <header className="nav large"><div className="lt">Wallet</div><span style={{ display: 'flex', gap: '.5rem' }}><Link className="nb" href="/settings" aria-label="Settings"><Settings size={20} aria-hidden /></Link><Link href="/profile" aria-label="Profile"><Avatar size={36} cls="me-av" /></Link></span></header>
      <main className="body wallet">
        <section className="pcard" aria-label="Pocket Cash, total balance">
          <div className="pc-top"><div className="brand"><Coil /><span>Pocket Cash</span></div><span className="tag cc-tag">NEAR testnet</span></div>
          <div className="pc-bot"><div className="pc-lab">Total balance</div><div className="pc-v">{ready ? <Money v={sm.total} /> : <span className="skel" style={{ display: 'inline-block', width: '8rem', height: '2.4rem' }} />}</div>
            <div className="pc-id" onClick={(e) => { e.preventDefault(); copy(s.account, 'Account copied'); }}>{s.account} <Copy size={14} aria-hidden /></div></div>
        </section>
        <div className="acts4">
          <Link href="/send"><span className="ci"><ArrowUpRight size={22} strokeWidth={2.2} aria-hidden /></span>Send</Link>
          <button onClick={() => setSheet('recv')}><span className="ci"><ArrowDownLeft size={22} strokeWidth={2.2} aria-hidden /></span>Receive</button>
          <Link href="/swap"><span className="ci"><ArrowDownUp size={22} strokeWidth={2.2} aria-hidden /></span>Swap</Link>
          <button onClick={() => setSheet('add')}><span className="ci"><Plus size={22} strokeWidth={2.2} aria-hidden /></span>Add</button>
        </div>
        <div className="ghead"><b>Balances</b><Link className="link" href="/contacts">Contacts</Link></div>
        <section className="group list">
          <Link className="row w-chev" href="/coin/usdc"><span className="logo usdc"><Logo name="usdc" /></span><span className="rn"><span className="nm">USDC</span><span className="sb">Circle, on NEAR testnet</span></span><span className="px"><span className="p">{fmt(sm.usdc)}</span><span className="c plain">${fmt(sm.usdc)}</span></span><span className="chev2"><ChevronRight size={16} aria-hidden /></span></Link>
          <Link className="row w-chev" href="/coin/near"><span className="logo near"><Logo name="near" /></span><span className="rn"><span className="nm">NEAR</span><span className="sb">For your account</span></span><span className="px"><span className="p">{fmt(sm.near)}</span><span className="c plain">{q.data ? '$' + fmt(sm.nearUsd) : '\u00a0'}</span></span><span className="chev2"><ChevronRight size={16} aria-hidden /></span></Link>
          <div className="row w-chev"><span className="logo"><Logo name="pusd" /></span><span className="rn"><span className="nm">pUSD</span><span className="sb">Pocket test dollar</span></span><span className="px"><span className="p">{fmt(sm.pusd)}</span><span className="c plain">${fmt(sm.pusd)}</span></span><span /></div>
          <Link className="row w-chev" href="/invest"><span className="logo txt"><ChartLine size={18} aria-hidden /></span><span className="rn"><span className="nm">Paper stocks</span><span className="sb">{held} {held === 1 ? 'holding' : 'holdings'}</span></span><span className="px"><span className="p">${fmt(sm.stocks)}</span><span className={'c ' + (sm.stocksDay >= 0 ? 'up' : 'dn')}>{sm.stocksDay >= 0 ? '+' : '−'}${fmt(Math.abs(sm.stocksDay))} today</span></span><span className="chev2"><ChevronRight size={16} aria-hidden /></span></Link>
        </section>
        {b.error && <div className="errline">Could not read balances: {String(b.error)}</div>}
        <div className="ghead"><b>Activity</b><Link className="link" href="/activity">See all</Link></div>
        <ActivityList />
      </main>
    </AppShell>
  );
}
export default function Page() { return <Gate><WalletInner /></Gate>; }
