'use client';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronDown, ChevronLeft, ChevronRight, CircleX, ClipboardPaste, Link as LinkIcon, Search, ShieldCheck, TriangleAlert } from 'lucide-react';
import { AppShell, HoldButton, Logo, Sheet, fmt, toast, toastErr } from '@/ui/kit';
import { Gate } from '@/ui/Gate';
import { ScanButton } from '@/ui/qr';
import { AvatarFor } from '@/ui/Avatar';
import { Keypad, press } from '@/ui/Keypad';
import { api, passkeyApprove, send } from '@/lib/client/api';
import { summary, useBalances, useQuotes } from '@/lib/client/data';
import { getRules, saveContact, useContacts, useRules, useSession, type Contact } from '@/lib/client/session';
import { detect } from '@/lib/shared/address';
import { ROOT } from '@/lib/shared/deployment';

type Asset = 'pUSD' | 'USDC' | 'NEAR';
type Net = 'near' | 'sol' | 'eth' | 'pol';
const NETS: Record<Net, { n: string; logo: string; t: string }> = { near: { n: 'NEAR', logo: 'near', t: 'testnet' }, sol: { n: 'Solana', logo: 'solana', t: 'devnet' }, eth: { n: 'Ethereum', logo: 'ethereum', t: 'Sepolia' }, pol: { n: 'Polygon', logo: 'polygon', t: 'Amoy' } };
const ASSETS: { sym: Asset; logo: string; sub: string }[] = [{ sym: 'pUSD', logo: 'pusd', sub: 'Pocket test dollar, NEAR accounts' }, { sym: 'USDC', logo: 'usdc', sub: 'Circle testnet USDC, NEAR accounts' }, { sym: 'NEAR', logo: 'near', sub: 'NEAR accounts only' }];
const NB = ({ k }: { k: Net }) => <span className="nbadge"><span className={'nl ' + k}><Logo name={NETS[k].logo} /></span>{NETS[k].n}</span>;
const short = (a: string) => (a.length > 22 ? a.slice(0, 6) + '…' + a.slice(-6) : a);
type Target = { account: string; label: string; net: Net; kind: string; why: string; pocket: boolean; exists: boolean; contact?: Contact };

function XSend() {
  const sp = useSearchParams();
  const router = useRouter();
  const s = useSession()!;
  const contacts = useContacts();
  const rules = useRules();
  const b = useBalances(); const qq = useQuotes(); const sm = summary(b.data, qq.data);
  const [asset, setAsset] = useState<Asset>((sp.get('asset') as Asset) || 'pUSD');
  const [step, setStep] = useState<'to' | 'detect' | 'amount' | 'review' | 'sent'>('to');
  const [qs, setQs] = useState(sp.get('to') || '');
  const [tgt, setTgt] = useState<Target | null>(null);
  const [derr, setDerr] = useState('');
  const [net, setNet] = useState<Net | null>(null);
  const [amt, setAmt] = useState(sp.get('amt') || '');
  const [note, setNote] = useState('');
  const [sheet, setSheet] = useState<'' | 'asset' | 'network' | 'save'>('');
  const [busy, setBusy] = useState(false);
  const [hash, setHash] = useState('');
  const [saveName, setSaveName] = useState('');
  const inp = useRef<HTMLInputElement>(null);
  const bal = asset === 'pUSD' ? sm.pusd : asset === 'USDC' ? sm.usdc : sm.near;
  const n = Number(amt || 0);
  const dollars = asset === 'NEAR' ? n * (qq.data?.tokens.NEAR?.price || 0) : n;
  const left = Math.max(0, (b.data?.limit ?? rules.limit) - (b.data?.usedToday ?? 0));
  const keepOk = asset === 'NEAR' || sm.dollars - n >= rules.keep;
  const amtErr = n > bal ? `You have ${fmt(bal, asset === 'NEAR' ? 4 : 2)} ${asset}.` : asset === 'NEAR' && sm.near - n < 0.05 ? 'Leave 0.05 NEAR for your account storage.' : !keepOk ? `That goes under the $${fmt(rules.keep)} you keep.` : dollars > left ? `Over your daily limit. $${fmt(left)} left today.` : asset === 'NEAR' && n > 5 ? 'Pocket sends up to 5 NEAR at a time on testnet.' : '';

  const q = qs.trim().toLowerCase();
  const shown = useMemo(() => contacts.filter((c) => !q || c.name.toLowerCase().includes(q) || c.address.includes(q)), [contacts, q]);
  const pocketC = shown.filter((c) => c.kind === 'pocket'); const walletC = shown.filter((c) => c.kind === 'wallet');

  const pickContact = (c: Contact) => {
    if (c.network !== 'near') { setTgt({ account: c.address, label: c.name, net: c.network, kind: NETS[c.network].n + ' address', why: 'Saved by you', pocket: false, exists: true, contact: c }); setNet(c.network); setStep('detect'); return; }
    setTgt({ account: c.address, label: c.name, net: 'near', kind: c.kind === 'pocket' ? 'Pocket user' : 'NEAR account', why: c.address, pocket: c.kind === 'pocket', exists: true, contact: c }); setNet('near'); setStep(amt ? 'review' : 'amount');
  };
  const runDetect = async (raw: string, forceNet?: Net) => {
    setDerr(''); setTgt(null);
    const exact = contacts.find((c) => c.name.toLowerCase() === raw.trim().toLowerCase());
    if (exact) return pickContact(exact);
    const d = detect(raw, ROOT);
    setStep('detect');
    if (d.kind === 'empty') { setStep('to'); return; }
    if (d.kind === 'mainnet' || d.kind === 'unsupported') { setDerr(d.reason); return; }
    if (d.kind === 'solana') { setNet('sol'); setTgt({ account: d.address, label: short(d.address), net: 'sol', kind: 'Solana address', why: 'Base58, 32 to 44 characters', pocket: false, exists: true }); return; }
    if (d.kind === 'evm-or-near') {
      const nn = forceNet || net; if (!nn) { setSheet('network'); setTgt({ account: d.address, label: short(d.address), net: 'eth', kind: '0x address', why: 'Could be Ethereum, Polygon or a NEAR 0x account. Pick the network.', pocket: false, exists: true }); return; }
      setTgt({ account: d.address, label: short(d.address), net: nn, kind: nn === 'near' ? 'NEAR 0x account' : NETS[nn].n + ' address', why: nn === 'near' ? 'NEAR eth implicit account on testnet' : 'You picked ' + NETS[nn].n, pocket: false, exists: true }); return;
    }
    const qy = d.kind === 'username' ? d.username : d.account;
    try {
      const r = await api<{ account: string; exists: boolean; pocket: boolean }>(`/api/account/lookup?q=${encodeURIComponent(qy)}`);
      if (!r.exists && d.kind !== 'near-implicit') { setDerr(d.kind === 'username' ? `No Pocket user called @${d.username} and no saved contact by that name.` : `${r.account} does not exist on NEAR testnet.`); return; }
      if (r.account === s.account) { setDerr('That is you.'); return; }
      setNet('near');
      setTgt({ account: r.account, label: r.pocket ? '@' + r.account.split('.')[0] : short(r.account), net: 'near', kind: r.pocket ? 'Pocket user' : d.kind === 'near-implicit' ? 'NEAR implicit account' : 'NEAR testnet account', why: r.exists ? r.account : 'New implicit account, it will be created by the send', pocket: r.pocket, exists: r.exists });
    } catch (e) { setDerr(e instanceof Error ? e.message : String(e)); }
  };
  useEffect(() => { const t = sp.get('to'); if (t) runDetect(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const live = tgt?.net === 'near';
  const assetOk = !(tgt && !tgt.pocket && asset === 'pUSD' && false);
  const go = async () => {
    if (!tgt) return; setBusy(true);
    try {
      if (getRules().passkey) await passkeyApprove(getRules().passkeyId);
      const r = await send({ to: tgt.account, amount: String(n), asset, memo: note || undefined, toName: tgt.contact?.name || tgt.label });
      setHash(r.hash); setStep('sent');
      if (!tgt.contact) { setSaveName(tgt.pocket ? tgt.label.replace('@', '') : ''); setTimeout(() => setSheet('save'), 600); }
    } catch (e) { toastErr(e); } finally { setBusy(false); }
  };
  const back = () => { if (step === 'to') router.back(); else if (step === 'detect' || step === 'amount') { setStep('to'); setTgt(null); setDerr(''); } else if (step === 'review') setStep('amount'); else router.push('/wallet'); };
  const A = ASSETS.find((x) => x.sym === asset)!;
  return (
    <AppShell screen="xsend" tab="send" noTabs overlay={<>
      <Sheet open={sheet === 'asset'} onClose={() => setSheet('')} label="Pick what to send"><div className="sh-t">What do you want to send?</div>
        <section className="group">{ASSETS.map((a) => <button key={a.sym} className={'opt' + (a.sym === asset ? ' on' : '')} onClick={() => { setAsset(a.sym); setSheet(''); }}><span className={'logo ' + a.logo}><Logo name={a.logo} /></span><span className="lft2"><span className="ot">{a.sym}</span><span className="os">{fmt(a.sym === 'pUSD' ? sm.pusd : a.sym === 'USDC' ? sm.usdc : sm.near, a.sym === 'NEAR' ? 4 : 2)} · {a.sub}</span></span><span className="rd">{a.sym === asset && <Check size={14} strokeWidth={3} aria-hidden />}</span></button>)}</section>
        {asset === 'USDC' && sm.usdc === 0 && <a className="note2" href="https://faucet.circle.com/" target="_blank" rel="noreferrer"><span>No USDC yet. Get free testnet USDC from Circle and pick NEAR testnet.</span></a>}
      </Sheet>
      <Sheet open={sheet === 'network'} onClose={() => setSheet('')} label="Pick the network"><div className="sh-t">Which network is this on?</div>
        <div className="sh-s">0x addresses look the same on Ethereum, Polygon and NEAR. Ask where their wallet lives. Pocket never guesses for you.</div>
        <section className="group">{([['eth', 'Fee about 0.40 USDC', false], ['pol', 'Fee about 0.03 USDC', false], ['near', 'Fee 0.00, Pocket pays it', true]] as [Net, string, boolean][]).map(([k, fee, lv]) => <button key={k} className={'opt' + (net === k ? ' on' : '')} onClick={() => setNet(k)}><span className={'logo ' + k}><Logo name={NETS[k].logo} /></span><span className="lft2"><span className="ot">{k === 'near' ? 'NEAR 0x account' : NETS[k].n} <span className={lv ? 'lv' : 'rm'}>{lv ? 'Live' : 'Roadmap'}</span></span><span className="os">{NETS[k].n} {NETS[k].t}. {fee}</span></span><span className="rd">{net === k && <Check size={14} strokeWidth={3} aria-hidden />}</span></button>)}</section>
        <button className="btn big" style={{ marginTop: '.9rem' }} disabled={!net} onClick={() => { setSheet(''); runDetect(qs, net!); }}>Use this network</button>
      </Sheet>
      <Sheet open={sheet === 'save'} onClose={() => setSheet('')} label="Save as contact"><div className="sh-t">Save as a contact?</div>
        <div className="sh-s">Next time, type the name instead of the address.</div>
        <label className="field focus"><input className="inp" aria-label="Contact name" placeholder="Name, like Mum" value={saveName} onChange={(e) => setSaveName(e.target.value)} maxLength={40} /></label>
        {tgt && <div style={{ margin: '.7rem .2rem .9rem', display: 'flex', gap: '.5rem', alignItems: 'center', fontSize: '.875rem', color: 'var(--ink-2)' }}><NB k={tgt.net} /> <span className="mono">{short(tgt.account)}</span></div>}
        <div className="acts2"><button className="btn ghost" onClick={() => setSheet('')}>Not now</button><button className="btn" disabled={!saveName.trim()} onClick={() => { if (tgt) { saveContact({ name: saveName.trim(), address: tgt.account, network: tgt.net, kind: tgt.pocket ? 'pocket' : 'wallet', sends: 1, lastAt: Date.now() }); toast(`Saved. Next time type ${saveName.trim()}`); } setSheet(''); }}>Save contact</button></div>
      </Sheet>
    </>}>
      <header className="nav"><button className="nb back" aria-label="Back" onClick={back}><ChevronLeft size={26} strokeWidth={2} aria-hidden /></button><div className="nt">Send <span className="asym">{asset}</span></div><span className="nb" style={{ visibility: 'hidden' }} /></header>

      {step === 'to' && <main className="body stepv on">
        <button className="assetpill" onClick={() => setSheet('asset')} aria-label="Change asset"><span className={'logo ' + A.logo}><Logo name={A.logo} /></span><b className="asym">{asset}</b><span>{fmt(bal, asset === 'NEAR' ? 4 : 2)}</span><ChevronDown size={16} aria-hidden /></button>
        <form className="field focus" onSubmit={(e) => { e.preventDefault(); if (qs.trim()) runDetect(qs); }}>
          <input ref={inp} className="inp in" autoFocus aria-label="Recipient" placeholder="Name, @username, .testnet or address" value={qs} onChange={(e) => setQs(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
          <button type="button" className="fb" onClick={async () => { try { const t = await navigator.clipboard.readText(); setQs(t.trim()); runDetect(t.trim()); } catch { inp.current?.focus(); toast('Paste with your keyboard'); } }}><ClipboardPaste size={15} aria-hidden />Paste</button>
          <ScanButton onResult={(r, raw) => { if (!r) { toast(raw ? 'That QR code is not a Pocket pay link or NEAR account.' : 'No QR code found in that photo. Try again closer.'); return; } setQs(r.to); if (r.amt && /^\d+(\.\d+)?$/.test(r.amt)) setAmt(r.amt); runDetect(r.to); }} />
        </form>
        {q && <button className="btn big" onClick={() => runDetect(qs)}>Continue with {qs.trim().length > 24 ? short(qs.trim()) : qs.trim()}</button>}
        {!contacts.length && !q && <div className="note2"><Search size={16} aria-hidden /><span>Type a username like <b>@{s.username}</b>, a .testnet account, or a 0x address. Save people as contacts and send by name.</span></div>}
        {pocketC.length > 0 && <><div className="sec-h"><span>On Pocket and NEAR</span><span className="tagline">Free and instant</span></div>
          <section className="group">{pocketC.concat(walletC.filter((c) => c.network === 'near')).map((c) => <button key={c.id} className="opt rcp" onClick={() => pickContact(c)}><AvatarFor value="" name={c.name} size={40} cls="logo ph" /><span className="lft2"><span className="ot"><span className="nm">{c.name}</span>{c.kind === 'pocket' ? <span className="lv">Pocket</span> : <NB k="near" />}</span><span className="os">{short(c.address)}{c.sends ? `, sent ${c.sends} ${c.sends === 1 ? 'time' : 'times'}` : ''}</span></span><span className="chev"><ChevronRight size={16} aria-hidden /></span></button>)}</section></>}
        {walletC.filter((c) => c.network !== 'near').length > 0 && <><div className="sec-h"><span>Saved addresses</span><Link className="tagline" href="/contacts">See all</Link></div>
          <section className="group">{walletC.filter((c) => c.network !== 'near').map((c) => <button key={c.id} className="opt rcp" onClick={() => pickContact(c)}><span className={'logo ' + c.network}><Logo name={NETS[c.network].logo} /></span><span className="lft2"><span className="ot"><span className="nm">{c.name}</span><NB k={c.network} /></span><span className="os mono">{short(c.address)}</span></span><span className="chev"><ChevronRight size={16} aria-hidden /></span></button>)}</section></>}
        {!q && <><div className="sec-h"><span>Pay links</span><span className="tagline">Share yours to get paid</span></div>
          <section className="group"><Link className="opt" href="/profile#paylink"><span className="logo txt"><LinkIcon size={18} aria-hidden /></span><span className="lft2"><span className="ot">Your pay link</span><span className="os">pocket/pay/{s.username}. Anyone with Pocket can pay you</span></span><span className="chev"><ChevronRight size={16} aria-hidden /></span></Link>
          <div className="opt"><span className="logo txt"><LinkIcon size={18} aria-hidden /></span><span className="lft2"><span className="ot">Send with a claim link <span className="rm">Roadmap</span></span><span className="os">For people who are not on Pocket yet</span></span></div></section></>}
      </main>}

      {step === 'detect' && <main className="body stepv on">
        <div className="field focus"><span className="in val mono" style={{ overflowWrap: 'anywhere' }}>{qs || tgt?.account}</span><button className="fx" aria-label="Clear" onClick={back}><CircleX size={18} aria-hidden /></button></div>
        <section className="group"><div className="detect">
          {derr ? <><span className="logo ph">?</span><div><div className="dt">Can&apos;t send here</div><div className="ds">{derr}</div></div></>
            : tgt ? <><span className={'logo ' + tgt.net}><Logo name={NETS[tgt.net].logo} /></span><div><div className="dt">{tgt.kind} <span className="lv">Detected</span></div><div className="ds" style={{ overflowWrap: 'anywhere' }}>{tgt.why}</div></div></>
            : <><span className="logo ph">…</span><div><div className="dt">Checking</div><div className="ds">Looking it up on NEAR testnet</div></div></>}
        </div></section>
        {tgt && !live && <div className="note2 warn"><TriangleAlert size={18} aria-hidden /><span><b>{NETS[tgt.net].n} is on the roadmap.</b> Cross chain sends need NEAR Intents bridges, which have no testnet. Pocket will not send there yet.</span></div>}
        {tgt && live && !tgt.pocket && asset === 'pUSD' && <div className="note2"><ShieldCheck size={18} aria-hidden /><span>pUSD lives inside the NEAR Intents verifier. They can see it with any Intents wallet, or you can switch to USDC.</span></div>}
        {tgt && tgt.net === 'near' && !tgt.exists && asset !== 'NEAR' && <div className="errline">This account does not exist yet. Send NEAR first to create it.</div>}
        <div style={{ marginTop: 'auto' }}><button className="btn big" disabled={!tgt || !live || !!derr || !assetOk || (!tgt.exists && asset !== 'NEAR')} onClick={() => setStep(amt ? 'review' : 'amount')}>Continue</button></div>
      </main>}

      {step === 'amount' && <main className="body stepv send on">
        <div className="amtwrap"><div className={'amt bold' + (amtErr ? ' over' : '')}>{amt || '0'}<span className="unit asym">{asset}</span></div><div className="bal">Balance <b>{fmt(bal, asset === 'NEAR' ? 4 : 2)}</b> <span className="asym">{asset}</span></div></div>
        <div className="feeline"><span className="k">Network fee on NEAR</span><span className="v">0.00, Pocket pays it</span></div>
        <div className="feeline" style={{ marginTop: '-.5rem' }}><span className="k">{tgt?.contact?.name || tgt?.label} gets</span><span className="v">{fmt(n, asset === 'NEAR' ? 4 : 2)} {asset}</span></div>
        {amtErr && <div className="errline" role="alert">{amtErr}</div>}
        <Keypad onKey={(k) => setAmt((x) => press(x, k, asset === 'NEAR' ? 4 : 2))} />
        <div className="cta"><button className="btn big" disabled={!(n > 0) || !!amtErr} onClick={() => setStep('review')}>Review</button></div>
      </main>}

      {step === 'review' && tgt && <main className="body stepv review on">
        <div className="who">{tgt.pocket || tgt.contact ? <AvatarFor value="" name={(tgt.contact?.name || tgt.label).replace('@', '')} size={56} cls="av" /> : <span className={'logo ' + tgt.net} style={{ width: '3.5rem', height: '3.5rem' }}><Logo name={NETS[tgt.net].logo} /></span>}
          <div className="big2">{fmt(n, asset === 'NEAR' ? 4 : 2)} <span style={{ fontSize: '.45em', opacity: 0.6 }}>{asset}</span></div>
          <div className="to">to <b>{tgt.contact?.name || tgt.label}</b>{tgt.contact || tgt.pocket ? <>, <span className="mono">{short(tgt.account)}</span></> : null} on <NB k="near" /> {!tgt.contact && <span className="chip">New</span>} {!amtErr && <span className="chip ok"><ShieldCheck size={12} aria-hidden />Checked</span>}</div></div>
        <section className="group bd">
          <div className="cell"><span className="k">You send</span><span className="v">{fmt(n, asset === 'NEAR' ? 4 : 2)} {asset}</span></div>
          <div className="cell"><span className="k">Network</span><span className="v">NEAR testnet</span></div>
          <div className="cell"><span className="k">NEAR gas</span><span className="v">0.00<small>Pocket pays it (NEP-366 relayer)</small></span></div>
          <div className="cell key"><span className="k">They get</span><span className="v">{fmt(n, asset === 'NEAR' ? 4 : 2)} {asset}</span></div>
          <div className="cell"><span className="k">Arrives</span><span className="v">about 2 s</span></div>
          <div className="cell"><span className="k">Route</span><span className="v">{asset === 'pUSD' ? 'NEAR Intents transfer' : 'NEAR transfer'}</span></div>
          <div className="cell after"><span className="k">Your balance after</span><span className="v">{fmt(bal - n, asset === 'NEAR' ? 4 : 2)} {asset}</span></div>
        </section>
        <label className="field"><input className="inp" aria-label="Add a note" placeholder="Add a note (optional)" value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} /></label>
        {amtErr && <div className="errline" role="alert">{amtErr}</div>}
        <div className="holdwrap">
          <HoldButton label={`Hold to send ${fmt(n, asset === 'NEAR' ? 4 : 2)} ${asset}`} doneLabel={busy ? 'Sending' : 'Sent'} onDone={go} disabled={!!amtErr || busy || !(n > 0)} />
          <div className="fine">Test money on NEAR testnet. Nothing real moves.{rules.passkey ? ' Your passkey is asked after you hold.' : ''}</div>
        </div>
      </main>}

      {step === 'sent' && tgt && <main className="body stepv on">
        <div className="donehero"><span className="ok"><Check size={36} strokeWidth={3} aria-hidden /></span><div className="dv">{fmt(n, asset === 'NEAR' ? 4 : 2)} <span className="unit">{asset}</span></div><div className="dd">Sent to <b>{tgt.contact?.name || tgt.label}</b> on NEAR testnet</div></div>
        <section className="group stepper">
          <div className="st"><span className="d"><Check size={14} strokeWidth={3} aria-hidden /></span><div><div className="tt">{rules.passkey ? 'Approved with your passkey' : 'Signed on your device'}</div><div className="ts">Just now</div></div></div>
          <div className="st"><span className="d"><Check size={14} strokeWidth={3} aria-hidden /></span><div><div className="tt">Sent on NEAR, gas paid by Pocket</div><div className="ts">Just now</div></div></div>
          <div className="st"><span className="d"><Check size={14} strokeWidth={3} aria-hidden /></span><div><div className="tt">Arrived</div><div className="ts">About 2 s</div></div></div>
        </section>
        <div className="acts2" style={{ marginTop: 'auto' }}><Link className="btn ghost" href={`/r/${hash}`}>View receipt</Link><Link className="btn" href="/wallet">Done</Link></div>
      </main>}
    </AppShell>
  );
}
export default function Page() { return <Gate><Suspense><XSend /></Suspense></Gate>; }
