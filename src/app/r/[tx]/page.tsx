'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDownToLine, ChartLine, Check, Copy, ExternalLink, Send, Share, UserPlus, X } from 'lucide-react';
import { AppShell, BackNav, fmt } from '@/ui/kit';
import { copy } from '@/ui/sheets';
import { getContacts, useSession } from '@/lib/client/session';
import { txUrl } from '@/lib/shared/deployment';

type R = { hash: string; ok: boolean; at: number | null; kind: string; token?: string; amount?: string; from?: string; to?: string; memo?: string | null; trade?: { side: string; token: string; qty: string; usd: string; price?: string; mid?: string; spreadBps?: string; source?: string; priceAt?: string; maker: string }; gasPaidBy: string; via: string; failures: string[] };
const nm = (a?: string) => { if (!a) return ''; const c = getContacts().find((x) => x.address === a); return c ? `${c.name}, ${a}` : a; };
const short = (h: string) => h.slice(0, 4) + '…' + h.slice(-4);
const tm = (ms: number) => new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function Page({ params }: { params: Promise<{ tx: string }> }) {
  const { tx } = use(params);
  const s = useSession();
  const [r, setR] = useState<R | null>(null); const [err, setErr] = useState('');
  useEffect(() => { let n = 0; let stop = false; const go = () => fetch('/api/receipt?tx=' + encodeURIComponent(tx)).then(async (x) => { const j = await x.json(); if (!x.ok) throw new Error(j.error || 'Not found'); setR(j); }).catch((e) => { if (!stop && ++n < 6) setTimeout(go, 1500); else setErr(e.message); }); go(); return () => { stop = true; }; }, [tx]);
  const share = async () => { const url = location.href; if (navigator.share) { try { await navigator.share({ title: 'Pocket receipt', url }); return; } catch { /* closed */ } } copy(url, 'Receipt link copied'); };
  let icon = <Send size={26} strokeWidth={2} aria-hidden />, amt = '', unit = '', title = '', sub = '';
  const rows: [string, React.ReactNode][] = [];
  if (r) {
    const mineOut = s && r.from === s.account;
    if (r.kind === 'send') { const out = mineOut || !s; amt = (out ? '−' : '+') + fmt(Number(r.amount)); unit = r.token || ''; title = out ? `Sent to ${nm(r.to).split(',')[0]}` : `From ${nm(r.from).split(',')[0]}`; sub = out ? r.to || '' : r.from || ''; if (!out) icon = <ArrowDownToLine size={26} aria-hidden />;
      rows.push(['To', nm(r.to)], ['From', nm(r.from)], ['Network', 'NEAR testnet'], ['Network fee', <>0.00<small>{r.gasPaidBy} paid the gas</small></>], [`${title.startsWith('Sent') ? nm(r.to).split(',')[0] : 'You'} got`, `${fmt(Number(r.amount))} ${r.token}`]); if (r.memo) rows.push(['Note', r.memo]); }
    else if (r.trade) { const t = r.trade; icon = <ChartLine size={26} aria-hidden />; const buy = t.side === 'buy'; amt = (buy ? '−' : '+') + fmt(Number(t.usd)); unit = 'pUSD'; title = `${buy ? 'Bought' : 'Sold'} ${t.token}`; sub = `${fmt(Number(t.qty), 4)} ${t.token}${t.price ? ' at $' + fmt(Number(t.price)) : ''}`;
      rows.push([buy ? 'You paid' : 'You sold', buy ? `${fmt(Number(t.usd))} pUSD` : `${fmt(Number(t.qty), 6)} ${t.token}`], [buy ? 'You got' : 'You got', buy ? `${fmt(Number(t.qty), 6)} ${t.token}` : `${fmt(Number(t.usd))} pUSD`]);
      if (t.price) rows.push(['Price', <>${fmt(Number(t.price))} per token<small>{t.source || 'CoinGecko'}{t.mid ? `, mid $${fmt(Number(t.mid))}` : ''}{t.priceAt && r.at ? `, ${Math.max(0, Math.round((r.at - Date.parse(t.priceAt)) / 1000))} s before` : ''}</small></>]);
      rows.push(['Spread', t.spreadBps ? fmt(Number(t.spreadBps) / 100) + '%' : 'N/A'], ['Filled by', t.maker], ['Network', 'NEAR testnet, NEAR Intents verifier']); }
    else if (r.kind === 'faucet') { icon = <ArrowDownToLine size={26} aria-hidden />; amt = '+' + fmt(Number(r.amount)); unit = r.token || 'pUSD'; title = 'Faucet claim'; sub = 'Pocket test dollar faucet'; rows.push(['From', r.from || 'Pocket faucet'], ['To', r.to || ''], ['Network', 'NEAR testnet']); }
    else if (r.kind === 'signup') { icon = <UserPlus size={26} aria-hidden />; title = 'Account created'; sub = r.to || ''; rows.push(['Account', r.to || ''], ['Created by', r.from || ''], ['Network', 'NEAR testnet']); }
    else { title = 'Transaction'; sub = r.via; rows.push(['Network', 'NEAR testnet']); }
    rows.push(['Transaction', <button key="h" className="mono" onClick={() => copy(r.hash, 'Transaction id copied')} style={{ display: 'inline-flex', gap: '.3rem', alignItems: 'center' }}>{short(r.hash)} <Copy size={14} aria-hidden /></button>]);
  }
  const steps: [string, string][] = r?.at ? (r.trade ? [['Signed on your device', tm(r.at)], ['Order filled on NEAR', tm(r.at)]] : [['Signed on your device', tm(r.at)], ['Sent on NEAR', tm(r.at)], ['Arrived', 'about 2 s']]) : [];
  return (
    <AppShell screen="receipt" tab="wallet" noTabs={!s}>
      <BackNav href={s ? '/wallet' : '/welcome'} title="Receipt" right={<button className="nb" aria-label="Share" onClick={share}><Share size={20} aria-hidden /></button>} />
      <main className="body receipt">
        {!r && !err && <><div className="skel" style={{ height: '9rem' }} /><div className="skel" style={{ height: '12rem' }} /></>}
        {err && <div className="empty">This receipt is not on NEAR testnet yet, or the id is wrong. {err}</div>}
        {r && <>
          <div className="rhead"><span className="ri">{icon}</span>{amt && <div className="rv">{amt} <span style={{ fontSize: '.4em', fontWeight: 650, opacity: 0.6 }}>{unit}</span></div>}<div className="rt"><b>{title}</b>{sub ? ', ' + sub : ''}</div>
            {r.ok ? <span className="chip ok"><Check size={12} aria-hidden /> Completed</span> : <span className="chip" style={{ color: 'var(--danger)' }}><X size={12} aria-hidden /> Failed</span>}</div>
          {r.ok && steps.length > 0 && <section className="group stepper">{steps.map(([a, b]) => <div className="st" key={a}><span className="d"><Check size={14} aria-hidden /></span><div><div className="tt">{a}</div><div className="ts">{b}</div></div></div>)}</section>}
          <section className="group bd">{rows.map(([k, v]) => <div className="cell" key={k}><span className="k">{k}</span><span className="v">{v}</span></div>)}</section>
          {!r.ok && <div className="errline">{r.failures.join(' ')}</div>}
          <a className="note2" href={txUrl(r.hash)} target="_blank" rel="noreferrer"><ExternalLink size={18} aria-hidden /><span>View on NearBlocks testnet</span></a>
          <div className="acts2">{r.kind === 'send' ? <Link className="btn ghost" href={`/send/to?to=${encodeURIComponent(r.to || '')}`}>Send again</Link> : r.trade ? <Link className="btn ghost" href={`/invest/${r.trade.token.replace(/on$/, '')}`}>Trade again</Link> : <Link className="btn ghost" href="/wallet">Wallet</Link>}<button className="btn" onClick={share}>Share receipt</button></div>
          <div className="src">Every number on this page is read from the NEAR testnet transaction itself.</div>
        </>}
      </main>
    </AppShell>
  );
}
