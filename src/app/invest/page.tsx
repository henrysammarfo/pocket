'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { AppShell, Chart, Chg, Logo, Money, RANGE_WORD, Ranges, fmt, resample } from '@/ui/kit';
import { Gate } from '@/ui/Gate';
import { ago, summary, useBalances, useQuotes, type Quotes } from '@/lib/client/data';
import { STOCKS } from '@/lib/shared/deployment';

const CRYPTO = [['NEAR', 'NEAR', 'near', 'NEAR Protocol'], ['USDC', 'USD Coin', 'usdc', 'Stablecoin']] as const;
const pct = (ch: number) => { const flat = Math.abs(ch) < 0.005; return <span className={'c ' + (flat ? '' : ch >= 0 ? 'up' : 'dn')}>{flat ? '0.00%' : (ch >= 0 ? '+' : '') + fmt(ch) + '%'}</span>; };

async function series(range: string, hold: Record<string, number>, q: Quotes): Promise<number[]> {
  const held = STOCKS.filter((s) => hold[s.ticker] > 0);
  if (!held.length) return [];
  let ps: number[][];
  if (range === '1D') ps = held.map((s) => resample([...(q.tokens[s.token]?.spark || []), q.tokens[s.token]?.price || 0], 96).map((x) => x * hold[s.ticker]));
  else {
    const ds = await Promise.all(held.map((s) => fetch('/api/stock?sym=' + s.ticker).then((r) => r.json())));
    ps = ds.map((d, k) => { const s = held[k]; const a: number[] = d.ranges?.[range] || []; const tok = q.tokens[s.token]?.price || 0; const sh = q.stocks[s.ticker]?.price || a[a.length - 1] || tok; return resample([...a, sh], 120).map((x) => (x * hold[s.ticker] * tok) / sh); });
  }
  const n = Math.min(...ps.map((p) => p.length));
  return Array.from({ length: n }, (_, i) => ps.reduce((a, p) => a + p[i], 0));
}

function InvestInner() {
  const b = useBalances(); const q = useQuotes(); const sm = summary(b.data, q.data);
  const [range, setRange] = useState('1D');
  const [pts, setPts] = useState<number[] | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const holdKey = JSON.stringify(sm.holdings);
  const ready = !!q.data && !!b.data;
  useEffect(() => { if (!ready) return; let on = true; series(range, sm.holdings, q.data!).then((p) => on && setPts(p)).catch(() => on && setPts([])); return () => { on = false; }; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, holdKey, ready, range === '1D' ? q.data?.tokensFetchedAt : 0]);
  const now = sm.stocks;
  const show = pts && pts.length > 1 ? [...pts.slice(0, -1), now] : null;
  const base = show ? show[0] : now;
  const v = scrub ?? now;
  const st = q.data && Object.values(q.data.stocks).find(Boolean);
  const age = q.data ? Math.max(...Object.values(q.data.tokens).map((t) => t.updatedAt || 0)) : 0;
  return (
    <AppShell screen="invest" tab="invest">
      <header className="nav large"><div className="lt">Invest</div><span className={'live' + (q.data ? ' ok' : '')}><i /><span>{q.data ? 'Live' : q.error ? 'Offline' : 'Connecting'}</span></span></header>
      <main className="body invest">
        <section className="phero">
          <div className="tk"><span>Your investments</span><span className="tag">Paper money</span></div>
          <div className="pv">{ready ? <Money v={v} /> : <span className="skel" style={{ display: 'inline-block', width: '9rem', height: '2.6rem' }} />}</div>
          {ready && (show ? <Chg d={v - base} base={base} when={RANGE_WORD[range]} /> : <span className="chg">You don&apos;t own any paper stocks yet. Pick one below.</span>)}
          {ready && sm.stocks > 0 ? <Chart pts={show} base={base} onScrub={setScrub} /> : !ready ? <div className="chart"><div className="ld">Loading chart</div></div> : null}
          {sm.stocks > 0 && <Ranges value={range} onChange={(r) => { setPts(null); setRange(r); }} />}
          {sm.stocks > 0 && <div className="srcline" style={{ padding: 0 }}>{range === '1D' ? '1D from token prices (CoinGecko). Longer ranges use the share prices the tokens track (Nasdaq.com).' : 'Share prices from Nasdaq.com, scaled to your token holdings.'}</div>}
        </section>
        <div className="ghead"><b>Stocks</b><span>Paper tokens priced from Ondo tokens</span></div>
        <section className="group list">
          {STOCKS.map((s) => { const t = q.data?.tokens[s.token]; const sh = q.data?.stocks[s.ticker]; const h = sm.holdings[s.ticker] || 0; return (
            <Link key={s.token} className="row w-chev" href={`/invest/${s.ticker}`}>
              <span className={'logo ' + s.cls}><Logo name={s.logo} /></span>
              <span className="rn"><span className="nm">{s.name}</span><span className="sb">{h > 0 ? `${fmt(h, 4)} ${s.token}` : sh?.price ? `${s.ticker} $${fmt(sh.price)}` : s.token}</span></span>
              <span className="px"><span className="p">{t ? '$' + fmt(t.price) : '\u00a0'}</span>{t ? pct(t.change24h || 0) : <span className="c" />}</span>
              <span className="chev2"><ChevronRight size={16} aria-hidden /></span>
            </Link>); })}
        </section>
        <div className="ghead"><b>Crypto</b><span>24 hours</span></div>
        <section className="group list">
          {CRYPTO.map(([s, n, c, sub]) => { const t = q.data?.tokens[s]; return (
            <Link key={s} className="row w-chev" href={`/coin/${c}`}>
              <span className={'logo ' + c}><Logo name={c} /></span>
              <span className="rn"><span className="nm">{n}</span><span className="sb">{sub}</span></span>
              <span className="px"><span className="p">{t ? '$' + fmt(t.price, s === 'USDC' ? 4 : 2) : '\u00a0'}</span>{t ? pct(t.change24h || 0) : <span className="c" />}</span>
              <span className="chev2"><ChevronRight size={16} aria-hidden /></span>
            </Link>); })}
        </section>
        <div className="src">{q.data ? `Live. Tokens: CoinGecko, ${ago(age)}. Shares: ${st ? st.source + ', ' + st.lastTrade.replace(/^.*\d{4} /, '') : 'not available'}. Paper money on testnet, not advice.` : q.error ? 'Prices are offline right now.' : 'Loading live prices'}</div>
      </main>
    </AppShell>
  );
}
export default function Page() { return <Gate><InvestInner /></Gate>; }
