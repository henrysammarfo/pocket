'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check } from 'lucide-react';
import { Brand } from '@/ui/kit';
import { signup, ROOT } from '@/lib/client/api';
import { useSession, setProfile, setSession } from '@/lib/client/session';
import { keyFromString } from '@/lib/shared/nep413';
import { viewAccessKey } from '@/lib/shared/rpc';

function Welcome() {
  const router = useRouter();
  const next = useSearchParams().get('next') || '/chat';
  const s = useSession();
  const [u, setU] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [theme, setTheme] = useState('light');
  const [restore, setRestore] = useState(false);
  const [bk, setBk] = useState('');
  const doRestore = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    try {
      const j = JSON.parse(bk.trim()) as { account?: string; secretKey?: string };
      if (!j.account || !j.secretKey) throw new Error('That backup is missing the account or the key.');
      const k = keyFromString(j.secretKey);
      setBusy('Checking your key on NEAR testnet');
      const ak = await viewAccessKey(j.account, k.publicKey);
      if (!ak) throw new Error('That key does not belong to ' + j.account + ' on NEAR testnet.');
      setSession({ account: j.account, username: j.account.split('.')[0], secretKey: k.secretKey, publicKey: k.publicKey, createdAt: Date.now() });
      setBusy(''); router.replace(next.startsWith('/') ? next : '/chat');
    } catch (e2) { setBusy(''); setErr(e2 instanceof SyntaxError ? 'Paste the backup exactly as you copied it from Profile.' : e2 instanceof Error ? e2.message : String(e2)); }
  };
  useEffect(() => { document.body.classList.add('land-body'); setTheme(document.documentElement.dataset.theme || 'light'); const f = () => setTheme(document.documentElement.dataset.theme || 'light'); document.addEventListener('themechange', f); return () => { document.body.classList.remove('land-body'); document.removeEventListener('themechange', f); }; }, []);
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setErr('');
    const clean = u.trim().toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9]([a-z0-9_-]{0,30}[a-z0-9])?$/.test(clean) || clean.length < 2) { setErr('Use 2 to 32 letters or numbers. Dash and underscore are fine inside.'); return; }
    try {
      setBusy('Making your key on this device');
      setTimeout(() => setBusy((b) => (b ? 'Creating your NEAR testnet account' : b)), 900);
      if (name.trim()) setProfile({ name: name.trim() });
      await signup(clean);
      setBusy('');
      router.replace(next.startsWith('/') ? next : '/chat');
    } catch (e2) { setBusy(''); setErr(e2 instanceof Error ? e2.message : String(e2)); }
  };
  return (
    <div className="land">
      <header className="lnav"><Brand /><nav><a href="#how">How it works</a><a href="#safety">Security</a><a href="https://github.com/henrysammarfo/pocket/tree/near-hackathon">Code</a></nav>{s ? <a className="btn" href="/chat">Open Pocket</a> : <a className="btn" href="#start">Get started</a>}</header>
      <section className="hero">
        <div>
          <div className="eyebrow"><i />Your money. Your rules.</div>
          <h1>Talk to your money. It listens to your rules.</h1>
          <p>Pocket is a money assistant you can chat with. Send test dollars to family anywhere, buy paper stocks, and see every receipt. Nothing moves until you approve it on your own device.</p>
          {s ? (
            <div className="hb"><a className="btn" href="/chat">Open Pocket as @{s.username}</a></div>
          ) : restore ? (
            <form id="start" className="welcome-form" onSubmit={doRestore}>
              <label className="field focus"><textarea className="inp mono" rows={3} aria-label="Your backup" placeholder='Paste your backup, like {"account":"…","secretKey":"ed25519:…"}' value={bk} onChange={(e) => setBk(e.target.value)} /></label>
              <button className="btn big" disabled={!!busy || !bk.trim()}>{busy || 'Restore my Pocket'}</button>
              {err && <div className="errline" role="alert">{err}</div>}
              <button type="button" className="btn text" onClick={() => { setRestore(false); setErr(''); }}>Create a new Pocket instead</button>
            </form>
          ) : (
            <form id="start" className="welcome-form" onSubmit={go}>
              <label className="field focus"><span className="in" style={{ flex: '0 0 auto', color: 'var(--ink-2)' }}>@</span><input className="inp" aria-label="Pick a username" placeholder="pick a username" value={u} onChange={(e) => setU(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={32} /><span className="suffix">.{ROOT}</span></label>
              <label className="field"><input className="inp" aria-label="Your first name" placeholder="Your first name (optional)" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></label>
              <button className="btn big" disabled={!!busy}>{busy || 'Create my Pocket'}</button>
              {err && <div className="errline" role="alert">{err}</div>}
              <button type="button" className="btn text" onClick={() => { setRestore(true); setErr(''); }}>I have a backup key</button>
              <div className="fine" style={{ fontSize: '.8125rem', color: 'var(--ink-3)', lineHeight: 1.45 }}>Your key is made in this browser and never leaves it. Pocket creates a NEAR testnet account for you, pays the gas, and gives you 1,000 test dollars. Nothing here has real value.</div>
            </form>
          )}
          <div className="checks">{['Runs on NEAR testnet', 'Fee $0 on sends', 'You sign every move'].map((t) => <span key={t}><Check size={16} strokeWidth={2.2} aria-hidden />{t}</span>)}</div>
        </div>
        <div className="hr"><div className="device"><div className="scr">{/* eslint-disable-next-line @next/next/no-img-element */}
<img src={theme === 'black' ? '/shots/chat-black.webp' : '/shots/chat-light.webp'} alt="Pocket chat with a plan card" /></div><span className="cap">Design preview with example data</span></div></div>
      </section>
      <section className="lsec" id="how">
        <h2>How it works</h2>
        <div className="grid3">
          <div className="group"><b>1. Say it</b><p>&quot;Send Mum 50 dollars and put 25 in Tesla.&quot; Pocket turns it into a plan card and checks it against your rules in code.</p></div>
          <div className="group"><b>2. Hold to approve</b><p>You hold the button for a second. Your device key signs the exact amounts on the card. The AI never holds a key.</p></div>
          <div className="group"><b>3. Settled on NEAR</b><p>Sends go through a relayer that pays the gas (NEP-366). Trades settle in one atomic call to the NEAR Intents verifier. Every move gets a public receipt.</p></div>
        </div>
      </section>
      <section className="lsec" id="safety">
        <h2>Safety, plainly</h2>
        <div className="grid3">
          <div className="group"><b>Testnet only</b><p>Test dollars (pUSD), Circle testnet USDC and paper stock tokens. No mainnet, no real money.</p></div>
          <div className="group"><b>Your rules hold</b><p>Always keep, daily send limit and passkey approval are checked before any card can be approved, and again by the server.</p></div>
          <div className="group"><b>Open and reproducible</b><p>Unmodified NEAR Intents verifier (sha256 on the health page), fixed supply tokens with no mint, one command to run your own.</p></div>
        </div>
      </section>
    </div>
  );
}
export default function Page() { return <Suspense><Welcome /></Suspense>; }
