'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { AppShell, BackNav, Logo, Sheet, toast, toastErr } from '@/ui/kit';
import { Gate } from '@/ui/Gate';
import { AvatarFor } from '@/ui/Avatar';
import { api } from '@/lib/client/api';
import { removeContact, saveContact, useContacts, type Contact } from '@/lib/client/session';
import { detect } from '@/lib/shared/address';
import { ROOT } from '@/lib/shared/deployment';

type Net = Contact['network'];
const NL: Record<Net, [string, string]> = { near: ['near', 'NEAR'], sol: ['solana', 'Solana'], eth: ['ethereum', 'Ethereum'], pol: ['polygon', 'Polygon'] };
const NB = ({ k }: { k: Net }) => <span className="nbadge"><span className={'nl ' + k}><Logo name={NL[k][0]} /></span>{NL[k][1]}</span>;
const short = (a: string) => (a.length > 22 ? a.slice(0, 6) + '…' + a.slice(-6) : a);

function ContactsInner() {
  const list = useContacts(); const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false); const [view, setView] = useState<Contact | null>(null);
  const [name, setName] = useState(''); const [addr, setAddr] = useState(''); const [net, setNet] = useState<Net | ''>('');
  const [busy, setBusy] = useState(false);
  const d = detect(addr, ROOT);
  const add = async () => {
    setBusy(true);
    try {
      if (!name.trim()) throw new Error('Give them a name.');
      if (list.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) throw new Error('You already have a contact with that name.');
      let address = addr.trim(), network: Net = 'near', kind: Contact['kind'] = 'wallet';
      if (d.kind === 'username' || d.kind === 'near-named' || d.kind === 'near-implicit') {
        const r = await api<{ account: string; exists: boolean; pocket: boolean }>(`/api/account/lookup?q=${encodeURIComponent(d.kind === 'username' ? d.username : d.account)}`);
        if (!r.exists && d.kind !== 'near-implicit') throw new Error(`${r.account} does not exist on NEAR testnet.`);
        address = r.account; kind = r.pocket ? 'pocket' : 'wallet';
      } else if (d.kind === 'solana') network = 'sol';
      else if (d.kind === 'evm-or-near') { if (!net) throw new Error('Pick the network for this 0x address.'); network = net; address = address.toLowerCase(); }
      else if (d.kind === 'mainnet' || d.kind === 'unsupported') throw new Error(d.reason);
      else throw new Error('Add an address.');
      saveContact({ name: name.trim(), address, network, kind });
      toast(`Saved ${name.trim()}`); setOpen(false); setName(''); setAddr(''); setNet('');
    } catch (e) { toastErr(e); } finally { setBusy(false); }
  };
  const f = list.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.address.includes(q.toLowerCase()));
  const row = (c: Contact) => <button key={c.id} className="opt" onClick={() => setView(c)}>{c.network === 'near' ? <AvatarFor value="" name={c.name} size={40} cls="logo ph" /> : <span className={'logo ' + c.network}><Logo name={NL[c.network][0]} /></span>}<span className="lft2"><span className="ot">{c.name} {c.kind === 'pocket' ? <span className="lv">Pocket</span> : <NB k={c.network} />}</span><span className="os mono">{short(c.address)}</span></span><span className="chev"><ChevronRight size={16} aria-hidden /></span></button>;
  return (
    <AppShell screen="contacts" tab="send" overlay={<>
      <Sheet open={open} onClose={() => setOpen(false)} label="Add contact"><div className="sh-t">Add a contact</div><div className="sh-s">Then just type their name in Chat or Send.</div>
        <div style={{ display: 'grid', gap: '.6rem' }}>
          <label className="field focus"><input className="inp" aria-label="Name" placeholder="Name, like Mum" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></label>
          <label className="field"><input className="inp mono" aria-label="Address" placeholder="@username, .testnet or address" value={addr} onChange={(e) => setAddr(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label>
          {d.kind === 'evm-or-near' && <section className="group">{(['near', 'eth', 'pol'] as Net[]).map((k) => <button key={k} className={'opt' + (net === k ? ' on' : '')} onClick={() => setNet(k)}><span className={'logo ' + k}><Logo name={NL[k][0]} /></span><span className="lft2"><span className="ot">{k === 'near' ? 'NEAR 0x account' : NL[k][1]} <span className={k === 'near' ? 'lv' : 'rm'}>{k === 'near' ? 'Live' : 'Roadmap'}</span></span></span></button>)}</section>}
          {(d.kind === 'mainnet' || d.kind === 'unsupported') && <div className="errline">{d.reason}</div>}
          {d.kind === 'solana' && <div className="note2"><span>Solana address. Saved for later; cross chain sends are on the roadmap.</span></div>}
          <button className="btn big" disabled={busy} onClick={add}>{busy ? 'Checking…' : 'Save contact'}</button>
        </div></Sheet>
      <Sheet open={!!view} onClose={() => setView(null)} label="Contact">{view && <>
        <div className="sh-t">{view.name}</div><div className="sh-s mono" style={{ overflowWrap: 'anywhere' }}>{view.address}</div>
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.8rem' }}><NB k={view.network} />{view.sends ? <span className="cs">Sent {view.sends} {view.sends === 1 ? 'time' : 'times'}</span> : null}</div>
        <div className="acts2"><button className="btn ghost" onClick={() => { removeContact(view.id); setView(null); toast('Removed'); }}><Trash2 size={16} aria-hidden /> Remove</button><button className="btn" disabled={view.network !== 'near'} onClick={() => router.push('/send/to?to=' + encodeURIComponent(view.name))}>{view.network === 'near' ? 'Send' : 'Roadmap'}</button></div></>}</Sheet>
    </>}>
      <BackNav href="/send" title="" right={<button className="nb" aria-label="Add contact" onClick={() => setOpen(true)}><Plus size={22} aria-hidden /></button>} />
      <main className="body"><div className="lt" style={{ padding: '0 .25rem' }}>Contacts</div>
        <label className="field"><Search size={16} aria-hidden /><input className="inp" aria-label="Search names" placeholder="Search names" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        {!list.length && <div className="empty">No contacts yet. Add one with the plus button, or save someone after you send to them.<br /><button className="btn" style={{ marginTop: '.8rem' }} onClick={() => setOpen(true)}>Add a contact</button></div>}
        {f.some((c) => c.network === 'near') && <><div className="sec-h"><span>On Pocket and NEAR</span><span className="tagline">Free and instant</span></div><section className="group">{f.filter((c) => c.network === 'near').map(row)}</section></>}
        {f.some((c) => c.network !== 'near') && <><div className="sec-h"><span>Other networks</span><span className="tagline">Roadmap</span></div><section className="group">{f.filter((c) => c.network !== 'near').map(row)}</section></>}
        <div className="srcline"><ShieldCheck size={14} aria-hidden /><span>Each contact keeps its network. Pocket won&apos;t send a contact&apos;s address on any other network. Contacts stay in this browser.</span></div>
      </main>
    </AppShell>
  );
}
export default function Page() { return <Gate><ContactsInner /></Gate>; }
