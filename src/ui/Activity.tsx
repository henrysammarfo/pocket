'use client';
import Link from 'next/link';
import { ArrowDownLeft, ArrowDownToLine, ChartLine, ChevronRight, Send, UserPlus } from 'lucide-react';
import { api } from '@/lib/client/api';
import { useLive, useLocalActivity, useSession, getContacts } from '@/lib/client/session';
import { fmt } from './kit';
import { when } from '@/lib/client/data';

type Item = { kind: string; tx: string; data: Record<string, unknown>; at: number };
export function useActivity() {
  const s = useSession();
  const local = useLocalActivity();
  const srv = useLive<{ items: Item[] } | null>(() => (s ? api(`/api/activity?account=${encodeURIComponent(s.account)}`) : Promise.resolve(null)), [s?.account], 20000);
  const seen = new Set<string>();
  const all = [...local, ...(srv.data?.items || []).map((x) => ({ ...x, at: typeof x.at === 'number' ? x.at : new Date(x.at as unknown as string).getTime() }))]
    .filter((x) => { const k = x.kind + x.tx; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => b.at - a.at);
  return { items: all, loading: !srv.data && !srv.error && local.length === 0 };
}
const nameOf = (acct: string) => getContacts().find((c) => c.address === acct)?.name || (acct.endsWith('.pocketnear.testnet') ? '@' + acct.split('.')[0] : acct.length > 24 ? acct.slice(0, 8) + '…' + acct.slice(-6) : acct);
export function ActivityRow({ a }: { a: Item }) {
  const d = a.data as Record<string, string>;
  const [Icon, title, val, up] =
    a.kind === 'send' ? [Send, `Sent to ${d.toName || nameOf(String(d.to))}`, `−${fmt(Number(d.amount))} ${d.token}`, false]
    : a.kind === 'receive' ? [ArrowDownLeft, `From ${nameOf(String(d.from))}`, `+${fmt(Number(d.amount))} ${d.token}`, true]
    : a.kind === 'buy' ? [ChartLine, `Bought ${d.token}`, `${fmt(Number(d.qty), 4)} ${d.token}`, false]
    : a.kind === 'sell' ? [ChartLine, `Sold ${d.token}`, `+$${fmt(Number(d.usd))}`, true]
    : a.kind === 'faucet' ? [ArrowDownToLine, 'Faucet claim', `+${fmt(Number(d.amount))} ${d.token || 'pUSD'}`, true]
    : [UserPlus, 'Account created', '', false];
  return (
    <Link className="row w-chev" href={`/r/${a.tx}`}>
      <span className="logo txt"><Icon size={18} aria-hidden /></span>
      <span className="rn"><span className="nm">{title}</span><span className="sb">{when(a.at)}</span></span>
      <span className="px"><span className={'p' + (up ? ' up' : '')}>{val}</span></span>
      <span className="chev2"><ChevronRight size={16} aria-hidden /></span>
    </Link>
  );
}
export function ActivityList({ max = 6 }: { max?: number }) {
  const { items, loading } = useActivity();
  if (loading) return <section className="group list"><div className="skel" style={{ height: '3.5rem', margin: '.5rem' }} /></section>;
  if (!items.length) return <section className="group list"><div className="empty">No activity yet. Your first send or trade shows up here with a receipt.</div></section>;
  return <section className="group list">{items.slice(0, max).map((a) => <ActivityRow key={a.kind + a.tx} a={a} />)}</section>;
}
