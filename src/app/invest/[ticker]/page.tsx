'use client';
import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Info } from 'lucide-react';
import { AppShell, BackNav, Chart, Chg, Logo, Money, RANGE_WORD, Ranges, fmt, mcap, resample } from '@/ui/kit';
import { Gate } from '@/ui/Gate';
import { TradeSheet } from '@/ui/TradeSheet';
import { useActivity } from '@/ui/Activity';
import { ago, summary, useBalances, useQuotes, when } from '@/lib/client/data';
import { stockByTicker } from '@/lib/shared/deployment';

const ABOUT: Record<string, string> = {
  TSLA: 'Tesla designs and sells electric cars, home and grid batteries, and solar products. It is based in Austin, Texas.',
  NVDA: 'NVIDIA designs graphics and AI chips used in data centres, gaming PCs and cars. It is based in Santa Clara, California.',
  AAPL: 'Apple makes the iPhone, Mac, iPad and Apple Watch, and runs services like the App Store and iCloud. It is based in Cupertino, California.',
  SPY: 'SPY is a fund by State Street that holds the 500 large US companies in the S&P 500 index.',
  QQQ: 'QQQ is a fund by Invesco that holds the 100 largest non financial companies on the Nasdaq.',
};
type Detail = { stats: Record<string, string>; ranges: Record<string, number[]>; prevClose: number | null; firstDate?: Record<string, number>; source: string };
const hl = (s?: string) => (s && s.includes('/') ? s.split('/').map((x) => '$' + fmt(Number(x.replace(/[$,]/g, '')))).join(' to ') : s || 'N/A');

function StockInner({ ticker }: { ticker: string }) {
  const st = stockByTicker(ticker);
  const b = useBalances(); const q = useQuotes(); const sm = summary(b.data, q.data);
  const [d, setD] = useState<Detail | null>(null);
  const [range, setRange] = useState('1D');
  const [scrub, setScrub] = useState<number | null>(null);
  const [side, setSide] = useState<'' | 'buy' | 'sell'>('');
  const act = useActivity();
  useEffect(() => { if (!st) return; fetch('/api/stock?sym=' + st.ticker).then((r) => r.json()).then(setD).catch(() => setD(null)); }, [st]);
  const mine = useMemo(() => act.items.filter((a) => (a.kind === 'buy' || a.kind === 'sell') && (a.data as { token?: string }).token === st?.token), [act.items, st]);
  if (!st) return <AppShell screen="stock" tab="invest"><BackNav href="/invest" title="Not found" /><main className="body"><div className="empty">Pocket does not have that stock. <Link href="/invest">See all stocks</Link></div></main></AppShell>;
  const sq = q.data?.stocks[st.ticker];
  const tok = q.data?.tokens[st.token];
  const live = sq?.price ?? null;
  const pts = d && live ? [...resample(d.ranges[range] || [], range === '1D' ? 120 : 160), live] : null;
  const base = range === '1D' ? d?.prevClose || (live && sq?.change != null ? live - sq.change : pts?.[0] || 0) : pts?.[0] || 0;
  const shown = scrub ?? live ?? 0;
  const hold = sm.holdings[st.ticker] || 0;
  const buys = mine.filter((a) => a.kind === 'buy').map((a) => a.data as { qty: string; usd: number });
  const bq = buys.reduce((x, y) => x + Number(y.qty), 0), bu = buys.reduce((x, y) => x + Number(y.usd), 0);
  const avg = bq ? bu / bq : 0;
  const val = hold * (tok?.price || 0);
  const pl = avg ? val - hold * avg : 0;
  const today = val - val / (1 + (tok?.change24h || 0) / 100);
  const s = d?.stats || {};
  const stats: [string, string][] = [['Market cap', mcap(s.MarketCap)], ['Previous close', s.PreviousClose || 'N/A'], ["Today's range", hl(s.TodayHighLow)], ['52 week range', hl(s.FiftTwoWeekHighLow)], ['Volume', s.ShareVolume ? fmt(Number(String(s.ShareVolume).replace(/,/g, '')), 0) : 'N/A'], ['1 year target', s.OneYrTarget || 'N/A'], ['Exchange', s.Exchange || 'N/A'], ['Dividend', s.Yield && s.Yield !== 'N/A' ? s.Yield : 'None']];
  const word = range === 'All' && d?.firstDate?.All ? 'Since ' + new Date(d.firstDate.All).getFullYear() : RANGE_WORD[range];
  return (
    <AppShell screen="stock" tab="invest" cls="has-dock" wide overlay={side ? <TradeSheet open onClose={() => setSide('')} side={side} stock={st} sm={sm} limit={b.data?.limit ?? 200} usedToday={b.data?.usedToday ?? 0} /> : null}>
      <BackNav href="/invest" title={st.ticker} />
      <main className="body stock"><div className="colL">
        <div className="dhead"><span className={'logo ' + st.cls}><Logo name={st.logo} /></span><div><div className="nm">{st.name}</div><div className="sb">{st.token} paper token tracks {st.ticker}</div></div></div>
        <div><div className="bigp">{live ? <Money v={shown} /> : <span className="skel" style={{ display: 'inline-block', width: '9rem', height: '2.6rem' }} />}</div>
          {live && base ? <Chg d={shown - base} base={base} when={word} /> : <span className="chg">&nbsp;</span>}
          <span className={'mstat' + (/open/i.test(sq?.marketStatus || '') ? ' open' : '')}><i />{sq?.marketStatus || 'Market'}</span></div>
        <Chart pts={pts} base={base || undefined} onScrub={setScrub} />
        <Ranges value={range} onChange={setRange} />
        <div className="ghead"><b>Your position</b><span className="tag">Paper money</span></div>
        <section className="group poscard">
          {hold > 0 ? ([['Tokens', `${fmt(hold, 4)} ${st.token}`], ['Value', '$' + fmt(val)], ['Average cost', avg ? '$' + fmt(avg) + ' each' : 'N/A'], ['Token price', tok ? '$' + fmt(tok.price) : '…'], ['Total return', avg ? `${pl >= 0 ? '+' : '−'}$${fmt(Math.abs(pl))}` : 'N/A', pl >= 0 ? 'up' : 'dn'], ['Today', `${today >= 0 ? '+' : '−'}$${fmt(Math.abs(today))}`, today >= 0 ? 'up' : 'dn']] as [string, string, string?][]).map(([k, v, c]) => <div key={k}><div className="k">{k}</div><div className={'v ' + (c || '')}>{v}</div></div>)
            : <div style={{ gridColumn: '1/-1' }}><div className="k">Your position</div><div className="v">You don&apos;t own {st.name} yet</div></div>}
        </section>
        <div className="ghead"><b>Recent activity</b></div>
        <section className="group list">
          {mine.length ? mine.slice(0, 5).map((a) => { const x = a.data as { qty: string; usd: number }; return (
            <Link key={a.tx} className="row w-chev" href={`/r/${a.tx}`}><span className="logo txt">{a.kind === 'buy' ? <ArrowDownLeft size={18} aria-hidden /> : <ArrowUpRight size={18} aria-hidden />}</span><span className="rn"><span className="nm">{a.kind === 'buy' ? 'Bought' : 'Sold'} {fmt(Number(x.qty), 4)} {st.token}</span><span className="sb">{when(a.at)}, ${fmt(Number(x.usd))}</span></span><span className="px" /><span className="chev2"><ChevronRight size={16} aria-hidden /></span></Link>); })
            : <div className="empty">No trades in {st.token} yet.</div>}
        </section>
      </div><div className="colR">
        <div className="dock"><button className="btn ghost" disabled={!(hold > 0)} onClick={() => setSide('sell')}>Sell</button><button className="btn" disabled={!tok} onClick={() => setSide('buy')}>Buy</button></div>
        <div className="ghead"><b>About</b></div>
        <section className="group"><div className="about"><span>{ABOUT[st.ticker]}</span><div className="meta">{[s.Sector, s.Industry].filter(Boolean).map((x) => <span key={x} className="chip">{x}</span>)}</div></div></section>
        <div className="ghead"><b>Key stats</b><span>Nasdaq.com</span></div>
        <section className="group stats">{stats.map(([k, v]) => <div key={k}><div className="k">{k}</div><div className="v">{d ? v : '…'}</div></div>)}</section>
        <div className="srcline"><Info size={14} aria-hidden /><span>{sq ? `Share price: ${sq.source}, last trade ${sq.lastTrade.replace(/^.*\d{4} /, '')}. ` : ''}{tok ? `Token price: CoinGecko (${st.cg}), ${ago(tok.updatedAt)}. ` : ''}Paper money on testnet, not advice.</span></div>
      </div></main>
    </AppShell>
  );
}
export default function Page({ params }: { params: Promise<{ ticker: string }> }) { const { ticker } = use(params); return <Gate><StockInner ticker={ticker} /></Gate>; }
