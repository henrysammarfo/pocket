'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDownUp, Check, ChevronDown, Route } from 'lucide-react';
import { AppShell, BackNav, HoldButton, Logo, Sheet, fmt, toastErr } from '@/ui/kit';
import { Gate } from '@/ui/Gate';
import { getQuote, passkeyApprove, trade, type QuoteRes } from '@/lib/client/api';
import { ago, summary, useBalances, useQuotes } from '@/lib/client/data';
import { getRules, useRules } from '@/lib/client/session';
import { STOCKS } from '@/lib/shared/deployment';

type Tok = { sym: string; name: string; logo: string; cls: string };
const TOKS: Tok[] = [{ sym: 'pUSD', name: 'Pocket test dollar', logo: 'pusd', cls: '' }, ...STOCKS.map((s) => ({ sym: s.token, name: s.name, logo: s.logo, cls: s.cls })), { sym: 'USDC', name: 'USD Coin', logo: 'usdc', cls: 'usdc' }, { sym: 'NEAR', name: 'NEAR', logo: 'near', cls: 'near' }];
const isStock = (s: string) => STOCKS.some((x) => x.token === s);

function SwapInner() {
  const b = useBalances(); const qs = useQuotes(); const sm = summary(b.data, qs.data);
  const rules = useRules();
  const [from, setFrom] = useState('pUSD'); const [to, setTo] = useState('TSLAon');
  const [amt, setAmt] = useState('25');
  const [pick, setPick] = useState<'' | 'from' | 'to'>('');
  const [q, setQ] = useState<QuoteRes | null>(null); const [qe, setQe] = useState('');
  const [busy, setBusy] = useState(false); const [done, setDone] = useState<string | null>(null);
  const live = (from === 'pUSD' && isStock(to)) || (isStock(from) && to === 'pUSD');
  const side: 'buy' | 'sell' = from === 'pUSD' ? 'buy' : 'sell';
  const stock = STOCKS.find((s) => s.token === (side === 'buy' ? to : from));
  const balOf = (s: string) => s === 'pUSD' ? sm.pusd : s === 'USDC' ? sm.usdc : s === 'NEAR' ? sm.near : sm.holdings[STOCKS.find((x) => x.token === s)!.ticker] || 0;
  const priceOf = (s: string) => s === 'pUSD' ? 1 : qs.data?.tokens[s]?.price || 0;
  const n = Number(amt);
  const over = n > balOf(from) + 1e-9 || (from === 'pUSD' && balOf('pUSD') - n < rules.keep);
  useEffect(() => {
    setQ(null); setQe(''); setDone(null);
    if (!live || !stock || !(n > 0) || over) return;
    const t = setTimeout(() => getQuote(side, stock.token, side === 'buy' ? { usd: n } : { qty: n }).then(setQ).catch((e) => setQe(e instanceof Error ? e.message : String(e))), 350);
    return () => clearTimeout(t);
  }, [amt, from, to, live, over]); // eslint-disable-line react-hooks/exhaustive-deps
  const getAmt = q ? Number(q.quote.getUnits) / (side === 'buy' ? 1e18 : 1e6) : live ? 0 : n * priceOf(from) / (priceOf(to) || 1);
  const rate = priceOf(to) ? priceOf(from) / priceOf(to) : 0;
  const go = async () => { if (!q) return; setBusy(true); try { if (getRules().passkey) await passkeyApprove(getRules().passkeyId); const r = await trade(q); setDone(r.hash); } catch (e) { toastErr(e); } finally { setBusy(false); } };
  const T = (s: string) => TOKS.find((t) => t.sym === s)!;
  const choose = (s: string) => { if (pick === 'from') { if (s === to) setTo(from); setFrom(s); } else { if (s === from) setFrom(to); setTo(s); } setPick(''); };
  return (
    <AppShell screen="swap" tab="wallet" noTabs overlay={
      <Sheet open={!!pick} onClose={() => setPick('')} label="Pick a token"><h3 className="sh-t">{pick === 'from' ? 'You pay with' : 'You get'}</h3>
        <div className="group list">{TOKS.map((t) => <button key={t.sym} className="row" onClick={() => choose(t.sym)}><span className={'logo ' + t.cls}><Logo name={t.logo} /></span><span className="rn"><span className="nm">{t.sym}</span><span className="sb">{t.name}</span></span><span className="px"><span className="p">{fmt(balOf(t.sym), isStock(t.sym) ? 4 : 2)}</span>{(t.sym === 'USDC' || t.sym === 'NEAR') && <span className="rm">Roadmap</span>}</span>{(pick === 'from' ? from : to) === t.sym ? <Check size={16} aria-hidden /> : <span />}</button>)}</div>
      </Sheet>}>
      <BackNav href="/wallet" title="Swap" />
      <main className="body swap">
        <div className="swapbox">
          <div className="sbx"><div className="k"><span>You pay</span><span>Balance {fmt(balOf(from), isStock(from) ? 4 : 2)}</span></div><div className="r"><input className="amt2 inp" inputMode="decimal" aria-label="Amount you pay" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ''))} /><button className="tok" onClick={() => setPick('from')}><span className={'logo ' + T(from).cls}><Logo name={T(from).logo} /></span>{from} <ChevronDown size={16} aria-hidden /></button></div><div className="usd">{n > 0 && priceOf(from) ? '$' + fmt(n * priceOf(from)) : '\u00a0'}</div></div>
          <button className="swapbtn" aria-label="Flip" onClick={() => { setFrom(to); setTo(from); setAmt(getAmt ? String(Number(getAmt.toFixed(isStock(to) ? 6 : 2))) : amt); }}><ArrowDownUp size={20} strokeWidth={2.2} aria-hidden /></button>
          <div className="sbx"><div className="k"><span>You get about</span><span>Balance {fmt(balOf(to), isStock(to) ? 4 : 2)}</span></div><div className="r"><span className="amt2">{getAmt ? fmt(getAmt, isStock(to) ? 6 : 2) : '…'}</span><button className="tok" onClick={() => setPick('to')}><span className={'logo ' + T(to).cls}><Logo name={T(to).logo} /></span>{to} <ChevronDown size={16} aria-hidden /></button></div><div className="usd">{getAmt && priceOf(to) ? '$' + fmt(getAmt * priceOf(to)) : '\u00a0'}</div></div>
        </div>
        <section className="group bd">
          <div className="cell"><span className="k">Rate</span><span className="v">{rate ? `1 ${from} = ${fmt(rate, rate < 1 ? 6 : 2)} ${to}` : '…'}</span></div>
          <div className="cell"><span className="k">Spread</span><span className="v">{q ? fmt(q.quote.spreadBps / 100) + '%' : '0.20%'}<small>{q ? `In the signed quote. ${q.quote.priceSource}, ${ago(q.quote.priceAt)}` : 'Network fee 0.00, Pocket pays it'}</small></span></div>
          <div className="cell"><span className="k">Price can move</span><span className="v">No. The quote is fixed for 60 s</span></div>
          <div className="cell"><span className="k">Route</span><span className="v">{live ? <>NEAR Intents verifier <span className="lv">Live</span></> : <>NEAR Intents 1Click <span className="rm">Roadmap</span></>}</span></div>
        </section>
        {!live && <div className="note2 warn"><Route size={18} aria-hidden /><span><b>Not live on testnet yet.</b> Swaps between USDC and NEAR need NEAR Intents 1Click, which has no testnet. Swaps between pUSD and paper stocks work now.</span></div>}
        {over && <div className="errline" role="alert">{from === 'pUSD' && rules.keep ? `That goes under the $${fmt(rules.keep)} you keep.` : `You have ${fmt(balOf(from), 4)} ${from}.`}</div>}
        {qe && <div className="errline" role="alert">{qe}</div>}
        <div className="holdwrap">
          {done ? <div className="acts2"><Link className="btn ghost" href={`/r/${done}`}>See receipt</Link><button className="btn" onClick={() => { setDone(null); setAmt(''); }}>Swap again</button></div>
            : <HoldButton label="Hold to swap" doneLabel={busy ? 'Working' : 'Swapped'} hint="Keep holding to swap" onDone={go} disabled={!q || busy} resetKey={q?.quote.id} />}
          <div className="fine">{live ? 'Settles in one atomic call to the NEAR Intents verifier on testnet. Paper money, not advice.' : 'Live prices shown. This route is on the roadmap.'}</div>
        </div>
      </main>
    </AppShell>
  );
}
export default function Page() { return <Gate><SwapInner /></Gate>; }
