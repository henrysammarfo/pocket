'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ExternalLink } from 'lucide-react';
import { HoldButton, Sheet, fmt, toastErr } from './kit';
import { getQuote, passkeyApprove, trade, type QuoteRes } from '@/lib/client/api';
import { getRules, useRules } from '@/lib/client/session';
import { checkPlan } from '@/lib/shared/plan';
import type { Stock } from '@/lib/shared/deployment';
import { ago, type summary } from '@/lib/client/data';

type Sm = ReturnType<typeof summary>;
export function TradeSheet({ open, onClose, side, stock, sm, limit, usedToday }: { open: boolean; onClose: () => void; side: 'buy' | 'sell'; stock: Stock; sm: Sm; limit: number; usedToday: number }) {
  const rules = useRules();
  const [amt, setAmt] = useState('');
  const [max, setMax] = useState(false);
  const [q, setQ] = useState<QuoteRes | null>(null);
  const [qe, setQe] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ hash: string; qty: string; usd: number; price: number } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { if (open) { setAmt(''); setMax(false); setQ(null); setDone(null); setQe(''); } }, [open, side]);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  const hold = sm.holdings[stock.ticker] || 0;
  const price = sm.prices[stock.ticker] || 0;
  const n = Number(amt);
  const canBuy = Math.max(0, Math.floor((sm.pusd - rules.keep) * 100) / 100);
  const canSell = Math.floor(hold * price * 100) / 100;
  const cap = side === 'buy' ? Math.min(canBuy, 1000) : canSell;
  const step = side === 'buy' ? { type: 'buy' as const, ticker: stock.ticker, usd: n } : max ? { type: 'sell' as const, ticker: stock.ticker, qty: hold } : { type: 'sell' as const, ticker: stock.ticker, usd: n };
  const chk = n > 0 ? checkPlan({ id: 't', steps: [step], summary: '' }, { dollars: sm.dollars, pusd: sm.pusd, usdc: sm.usdc, near: sm.near, holdings: sm.holdings, keep: rules.keep, limit, usedToday, prices: sm.prices }) : null;
  useEffect(() => {
    setQ(null); setQe('');
    if (!open || !(n > 0) || !chk?.ok) return;
    const t = setTimeout(() => getQuote(side, stock.token, step.qty ? { qty: step.qty } : { usd: n }).then(setQ).catch((e) => setQe(e instanceof Error ? e.message : String(e))), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amt, max, side, open, chk?.ok]);
  const left = q ? Math.max(0, Math.round((q.quote.deadline - Date.now()) / 1000)) : 0;
  useEffect(() => { if (q && left === 0 && !busy && !done) { getQuote(side, stock.token, step.qty ? { qty: step.qty } : { usd: n }).then(setQ).catch(() => setQ(null)); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  const go = async () => {
    if (!q) return; setBusy(true);
    try { if (getRules().passkey) await passkeyApprove(getRules().passkeyId); const r = await trade(q); setDone(r); }
    catch (e) { toastErr(e); setQ(null); setAmt((a) => a); } finally { setBusy(false); }
  };
  const getQty = q ? Number(q.quote.side === 'buy' ? q.quote.getUnits : q.quote.payUnits) / 1e18 : 0;
  return (
    <Sheet open={open} onClose={onClose} label={`${side === 'buy' ? 'Buy' : 'Sell'} ${stock.token}`}>
      {done ? (
        <div style={{ textAlign: 'center', display: 'grid', gap: '.75rem' }}>
          <div className="bicon" style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}><Check size={30} strokeWidth={2.4} aria-hidden /></div>
          <div className="btitle">{side === 'buy' ? 'Bought' : 'Sold'} {fmt(Number(done.qty), 4)} {stock.token}</div>
          <div className="bwhy">at ${fmt(done.price)} each, ${fmt(done.usd)} in total. Settled in one call to the NEAR Intents verifier.</div>
          <Link className="btn big" href={`/r/${done.hash}`}>See receipt</Link><button className="btn text" onClick={onClose}>Done</button>
        </div>
      ) : (
        <>
          <h3 className="sh-t">{side === 'buy' ? 'Buy' : 'Sell'} {stock.name}</h3>
          <p className="sh-s">{side === 'buy' ? `You can spend $${fmt(canBuy)} pUSD${rules.keep ? `, keeping $${fmt(rules.keep)}` : ''}.` : `You hold ${fmt(hold, 4)} ${stock.token}, worth $${fmt(canSell)}.`}</p>
          <label className="field focus"><span className="in" style={{ flex: '0 0 auto', color: 'var(--ink-2)' }}>$</span><input className="inp" inputMode="decimal" aria-label="Amount in dollars" placeholder="0.00" value={amt} onChange={(e) => { setMax(false); setAmt(e.target.value.replace(/[^0-9.]/g, '')); }} /></label>
          <div className="quick" style={{ margin: '.6rem 0' }}>{[10, 25, 50].map((v) => <button key={v} onClick={() => { setMax(false); setAmt(String(v)); }}>${v}</button>)}<button onClick={() => { setMax(side === 'sell'); setAmt(String(cap)); }}>Max</button></div>
          <section className="group bd">
            <div className="cell"><span className="k">Price</span><span className="v">{q ? `$${fmt(q.quote.price)}` : price ? `about $${fmt(price)}` : '…'}<small>{q ? `${q.quote.priceSource}, ${ago(q.quote.priceAt)}` : 'Live, CoinGecko'}</small></span></div>
            <div className="cell"><span className="k">{side === 'buy' ? 'You get' : 'You sell'}</span><span className="v">{q ? `${fmt(getQty, 6)} ${stock.token}` : '…'}</span></div>
            <div className="cell"><span className="k">{side === 'buy' ? 'You pay' : 'You get'}</span><span className="v">{q ? `${fmt(q.quote.usd)} pUSD` : '…'}</span></div>
            <div className="cell"><span className="k">Spread</span><span className="v">{q ? fmt(q.quote.spreadBps / 100) + '%' : '0.20%'}<small>Network fee 0.00, Pocket pays it</small></span></div>
            {q && <div className="cell"><span className="k">Quote holds</span><span className="v">{left} s</span></div>}
          </section>
          {chk && !chk.ok && <div className="errline" role="alert" style={{ marginTop: '.5rem' }}>{chk.reasons.join(' ')}</div>}
          {qe && <div className="errline" role="alert" style={{ marginTop: '.5rem' }}>{qe}</div>}
          <div className="holdwrap" style={{ marginTop: '.75rem' }}>
            <HoldButton label={`Hold to ${side} $${fmt(n || 0)}`} doneLabel={busy ? 'Working' : 'Done'} hint={`Keep holding to ${side}`} onDone={go} disabled={!q || busy || left === 0} resetKey={q?.quote.id} />
            <div className="fine">Paper money on NEAR testnet, not advice. <a href="https://docs.near-intents.org" target="_blank" rel="noreferrer">How settlement works <ExternalLink size={11} aria-hidden /></a></div>
          </div>
        </>
      )}
    </Sheet>
  );
}
