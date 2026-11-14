'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AtSign, ChevronRight, Copy, Info, KeyRound, LogOut, Mail, Pencil, Share, Shirt, UserRound, Wallet } from 'lucide-react';
import { AppShell, BackNav, Sheet, toast } from '@/ui/kit';
import { Gate } from '@/ui/Gate';
import { Avatar, AvatarFor } from '@/ui/Avatar';
import { copy } from '@/ui/sheets';
import { EMOJI, KITS, emo, jersey } from '@/ui/avatars';
import { clearChats, setProfile, setSession, useProfile, useSession } from '@/lib/client/session';

function ProfileInner() {
  const s = useSession()!; const p = useProfile(); const router = useRouter();
  const [sheet, setSheet] = useState<'' | 'avatar' | 'name' | 'email' | 'key' | 'out'>('');
  const [pane, setPane] = useState<'kits' | 'emoji' | 'email'>(p.avatar.startsWith('emo:') ? 'emoji' : p.avatar.startsWith('kit:') ? 'kits' : 'email');
  const [val, setVal] = useState('');
  const [shown, setShown] = useState(false);
  const link = typeof location !== 'undefined' ? `${location.origin}/pay/${s.username}` : `/pay/${s.username}`;
  const share = async () => { if (navigator.share) { try { await navigator.share({ title: 'Pay me on Pocket', url: link }); return; } catch { /* closed */ } } copy(link, 'Pay link copied'); };
  const src = p.avatar.startsWith('kit:') ? 'Jersey avatar' : p.avatar.startsWith('emo:') ? 'Emoji avatar' : p.email ? 'Photo from your email (Gravatar), or a letter if it has none' : 'Add an email to use its photo';
  const idx = ['kits', 'emoji', 'email'].indexOf(pane);
  return (
    <AppShell screen="profile" tab="wallet" side="settings" overlay={<>
      <Sheet open={sheet === 'avatar'} onClose={() => setSheet('')} label="Choose an avatar"><div className="sh-t">Choose your avatar</div>
        <div className="seg avseg" role="tablist" style={{ width: '100%', margin: '.3rem 0 .8rem' }}><span className="thumb" style={{ width: 'calc(33.333% - 1.3px)', transform: `translateX(${idx * 100}%)` }} />
          {(['kits', 'emoji', 'email'] as const).map((k) => <button key={k} className={pane === k ? 'on' : ''} role="tab" aria-selected={pane === k} onClick={() => setPane(k)}>{k === 'kits' ? 'Jerseys' : k === 'emoji' ? 'Emoji' : 'Email photo'}</button>)}</div>
        {pane === 'kits' && <div className="avpane"><div className="avgrid">{KITS.map((k) => <button key={k.id} className={p.avatar === 'kit:' + k.id ? 'on' : ''} onClick={() => setProfile({ avatar: 'kit:' + k.id })}><span dangerouslySetInnerHTML={{ __html: jersey(k, { size: 68 }) }} /><span>{k.name}</span></button>)}</div><div className="srcline" style={{ padding: '0 .1rem .6rem' }}><Shirt size={14} aria-hidden /><span>Original kit designs. No club badges.</span></div></div>}
        {pane === 'emoji' && <div className="avpane"><div className="avgrid">{EMOJI.map((e, i) => <button key={i} className={p.avatar === 'emo:' + i ? 'on' : ''} onClick={() => setProfile({ avatar: 'emo:' + i })}><span dangerouslySetInnerHTML={{ __html: emo(e, 68) }} /><span>&nbsp;</span></button>)}</div></div>}
        {pane === 'email' && <div className="avpane"><div className="avgrid" style={{ gridTemplateColumns: '1fr 3fr', alignItems: 'center' }}><button className={p.avatar === 'email' ? 'on' : ''} onClick={() => setProfile({ avatar: 'email' })}><AvatarFor value="email" email={p.email} name={p.name || s.username} size={68} /><span>&nbsp;</span></button>
          <div style={{ fontSize: '.875rem', lineHeight: 1.45, color: 'var(--ink-2)' }}>{p.email ? <>From <b>{p.email}</b>. If your email has a Gravatar photo, Pocket uses it. If not, it shows your initials.</> : <>Add your email in Profile and Pocket uses its Gravatar photo. Your email stays in this browser; only its hash is sent to Gravatar.</>}</div></div></div>}
        <button className="btn big" onClick={() => setSheet('')}>Done</button></Sheet>
      <Sheet open={sheet === 'name' || sheet === 'email'} onClose={() => setSheet('')} label={sheet === 'name' ? 'Your name' : 'Your email'}><div className="sh-t">{sheet === 'name' ? 'Your name' : 'Your email'}</div><div className="sh-s">{sheet === 'name' ? 'Shown to you in Chat. Pocket keeps it in this browser.' : 'Used only for your avatar photo. It stays in this browser.'}</div>
        <form onSubmit={(e) => { e.preventDefault(); setProfile(sheet === 'name' ? { name: val.trim().slice(0, 40) } : { email: val.trim().slice(0, 120) }); setSheet(''); }}>
          <label className="field focus"><input className="inp" autoFocus type={sheet === 'email' ? 'email' : 'text'} aria-label={sheet === 'name' ? 'Name' : 'Email'} value={val} onChange={(e) => setVal(e.target.value)} /></label>
          <button className="btn big" style={{ marginTop: '.8rem', width: '100%' }}>Save</button></form></Sheet>
      <Sheet open={sheet === 'key'} onClose={() => { setSheet(''); setShown(false); }} label="Back up your key"><div className="sh-t">Back up your key</div><div className="sh-s">This key controls {s.account}. It only lives in this browser. Anyone with it can move your test money. Keep it private.</div>
        <div className="group" style={{ padding: '.8rem 1rem', overflowWrap: 'anywhere' }}><span className="mono" style={{ fontSize: '.8125rem', filter: shown ? 'none' : 'blur(6px)' }}>{s.secretKey}</span></div>
        <div className="acts2" style={{ marginTop: '.8rem' }}><button className="btn ghost" onClick={() => setShown((x) => !x)}>{shown ? 'Hide' : 'Show'}</button><button className="btn" onClick={() => copy(JSON.stringify({ account: s.account, secretKey: s.secretKey }), 'Backup copied. Store it somewhere safe')}><Copy size={16} aria-hidden /> Copy backup</button></div></Sheet>
      <Sheet open={sheet === 'out'} onClose={() => setSheet('')} label="Sign out"><div className="sh-t">Sign out of this browser?</div><div className="sh-s">Pocket deletes your key from this browser. Without a backup you cannot get back into {s.account}.</div>
        <div className="acts2"><button className="btn ghost" onClick={() => setSheet('key')}>Back up first</button><button className="btn" style={{ background: 'var(--danger)' }} onClick={() => { setSession(null); clearChats(); toast('Signed out'); router.replace('/welcome'); }}>Sign out</button></div></Sheet>
    </>}>
      <BackNav href="/settings" title="Profile" />
      <main className="body settings">
        <div className="profhead"><button className="avwrap" onClick={() => setSheet('avatar')} aria-label="Change avatar"><Avatar size={88} /><span className="ed"><Pencil size={16} strokeWidth={2.2} aria-hidden /></span></button><div className="pn">{p.name || s.username}</div><div className="pu">@{s.username}</div><div className="cs" style={{ fontSize: '.8125rem', color: 'var(--ink-3)' }}>{src}</div></div>
        <section className="group">
          <button className="cell" onClick={() => { setVal(p.name); setSheet('name'); }}><div className="lft"><span className="ic"><UserRound size={17} aria-hidden /></span><div className="ct">Name</div></div><span className="cv">{p.name || 'Add'} <ChevronRight size={16} aria-hidden /></span></button>
          <button className="cell" onClick={() => copy('@' + s.username, 'Username copied')}><div className="lft"><span className="ic"><AtSign size={17} aria-hidden /></span><div className="ct">Username</div></div><span className="cv">@{s.username} <Copy size={14} aria-hidden /></span></button>
          <button className="cell" onClick={() => { setVal(p.email); setSheet('email'); }}><div className="lft"><span className="ic"><Mail size={17} aria-hidden /></span><div className="ct">Email</div></div><span className="cv" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.email || 'Add'} <ChevronRight size={16} aria-hidden /></span></button>
          <button className="cell acct" onClick={() => copy(s.account, 'Account copied')}><div className="lft"><span className="ic"><Wallet size={17} aria-hidden /></span><div className="cl"><div className="ct">NEAR account</div><div className="cs mono" style={{ overflowWrap: 'anywhere', textAlign: 'left' }}>{s.account}</div></div></div><Copy size={16} aria-hidden style={{ flex: '0 0 auto', color: 'var(--ink-2)' }} /></button>
        </section>
        <div className="ghead" id="paylink"><b>Your pay link</b><span>People can send to you with it</span></div>
        <section className="group"><div className="paylink"><span className="pl">{link.replace(/^https?:\/\//, '')}</span><span style={{ display: 'flex', gap: '.4rem' }}><button className="nb" aria-label="Copy" onClick={() => copy(link, 'Pay link copied')}><Copy size={18} aria-hidden /></button><button className="nb" aria-label="Share" onClick={share}><Share size={18} aria-hidden /></button></span></div></section>
        <div className="ghead"><b>Your key</b></div>
        <section className="group">
          <button className="cell" onClick={() => setSheet('key')}><div className="lft"><span className="ic"><KeyRound size={17} aria-hidden /></span><div className="ct">Back up your key</div></div><span className="cv"><ChevronRight size={16} aria-hidden /></span></button>
          <button className="cell" onClick={() => setSheet('out')}><div className="lft"><span className="ic" style={{ color: 'var(--danger)' }}><LogOut size={17} aria-hidden /></span><div className="ct" style={{ color: 'var(--danger)' }}>Sign out of this browser</div></div><span className="cv"><ChevronRight size={16} aria-hidden /></span></button>
        </section>
        <div className="srcline"><Info size={14} aria-hidden /><span>Name, email and avatar stay in this browser. Pocket&apos;s server never sees them.</span></div>
      </main>
    </AppShell>
  );
}
export default function Page() { return <Gate><ProfileInner /></Gate>; }
