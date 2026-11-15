import type { Metadata } from 'next';
import { ArrowRight, BadgeCheck, Fingerprint, ShieldCheck } from 'lucide-react';
import { Cta, Reveal, StandaloneGate } from '@/ui/landing/Cta';
import { REPO, SiteFooter, SiteNav } from '@/ui/landing/Site';
import './landing.css';

export const metadata: Metadata = {
  title: 'Pocket, the money app you talk to',
  description: 'Say what your money should do. Pocket turns it into one plan, checks it against your rules, and nothing moves until you hold to approve. Test money only.',
};

// A phone frame that keeps the exact 390 by 844 shape of each screenshot, so nothing is cropped or stretched.
const Phone = ({ src, alt, cls = '', eager = false }: { src: string; alt: string; cls?: string; eager?: boolean }) => (
  <div className={'ph ' + cls}><div className="ph-scr">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={src} alt={alt} width={390} height={844} loading={eager ? 'eager' : 'lazy'} decoding="async" /></div><span className="ph-isl" /></div>
);

type Row = { id?: string; kick: string; h: string; p: string; facts: string[]; shots: [string, string][] };
const ROWS: Row[] = [
  { id: 'features', kick: 'Chat', h: 'Say it like you would to a friend.', p: 'Type what your money should do, in your own words. Pocket works out who, how much and which asset, then shows one plan card with every step.', facts: ['Names, @usernames and NEAR accounts', 'Live prices for stocks and crypto', 'Ask about anything, not just money'], shots: [['/land/chat.webp', 'A plan card in Pocket chat: send $5 to @admin and buy $10 of Tesla']] },
  { kick: 'Voice', h: 'Talk, even when it comes out messy.', p: 'Tap the mic and just speak. Ums, repeats, accents and Pidgin are fine. Pocket writes it down, says back what it understood, and waits for your yes.', facts: ['Tap or hold to talk, or send a voice note', 'Says it back before any plan', 'Runs on private AI in secure hardware'], shots: [['/land/listening.webp', 'Pocket listening to a voice message'], ['/land/voice.webp', 'Pocket saying back a messy voice note before making a plan']] },
  { kick: 'Photos', h: 'Snap the bill. Split it in one line.', p: 'Share a photo of a receipt or bill. Pocket reads the items and the total, and "split it with Ama" becomes a plan you can approve.', facts: ['Reads items, totals and currency', 'Photos are never stored', 'Text inside a photo cannot give orders'], shots: [['/land/photo.webp', 'Pocket reading a dinner bill and offering to split it']] },
  { kick: 'Approve', h: 'Nothing moves until you hold.', p: 'Every plan opens a review with the exact amounts, the fee and your balance after. Press and hold to sign it with the key on your own device.', facts: ['Network fees paid by Pocket', 'Settles on NEAR in about two seconds', 'A receipt rebuilt from the chain'], shots: [['/land/review.webp', 'Review screen with hold to send'], ['/land/sent.webp', 'A completed send with its receipt link']] },
  { kick: 'Wallet', h: 'Dollars, NEAR and paper stocks in one place.', p: 'See every balance at a glance, send to a saved name, share your pay link, and practise investing in Tesla, NVIDIA and more with paper money.', facts: ['Test dollars, USDC and NEAR', 'Paper stocks priced live', 'A daily limit and a keep amount you set'], shots: [['/land/wallet.webp', 'Pocket wallet with balances'], ['/land/invest.webp', 'Pocket invest list with live prices']] },
];
const STEPS = [
  ['Say it', 'Type, talk or share a photo.'],
  ['Check the plan', 'One card, checked in code against your rules.'],
  ['Hold to approve', 'Your device signs. NEAR settles in seconds.'],
];
const SAFE = [
  ['Your key stays with you', 'Made in your browser and never sent anywhere. Back it up from Profile, or sign out to remove it.'],
  ['The AI has no keys', 'It can only propose a plan. Code checks it, and you sign it. Nothing else can move your money.'],
  ['Rules that hold', 'Your daily limit and keep amount are enforced on the server. Raising a limit needs your signature and passkey.'],
  ['Private AI', 'Chats, photos and voice run on NEAR AI Cloud inside attested secure hardware, so the host cannot read them.'],
  ['Fees paid, with rules', 'Pocket only pays fees for allowed calls, caps every send, and refuses its own service accounts.'],
  ['Tested against attacks', 'A suite of prompt injection and abuse attempts runs on every release. Every one must be refused.'],
];
const FAQ = [
  ['Is this real money?', 'No. Pocket uses test money on NEAR. You get 1,000 test dollars when you join, and the stock tokens are paper. Nothing here has real value, so it is a safe place to learn.'],
  ['Do I need a wallet, an email or a seed phrase?', 'No. Pick a username and Pocket makes a private key inside your browser, creates your account and pays the fee. You can back the key up from Profile and add a passkey in Settings.'],
  ['Does Pocket use Privy or another login service?', 'No. There is no third party login. Your key is made and kept on your own device, which is why Pocket can never move money without you. A passkey (Face ID, fingerprint or screen lock) can guard every approval.'],
  ['Can the AI move my money?', 'No. The AI can only propose a plan card. Your rules are checked in code, and nothing moves until you press and hold to approve on your own device. Instructions hidden in pasted text or photos are ignored.'],
  ['Who can see my chats?', 'Chats, photos, voice notes and web searches are processed by private models on NEAR AI Cloud, inside attested secure hardware. Your chat history stays in your own browser, and the Pocket server keeps no chat text.'],
  ['What does it cost?', 'Pocket is free while it uses test money, with 1,000 AI credits a month. Sends cost you nothing; Pocket pays the network fee.'],
  ['Can I run my own copy?', 'Yes. The code is open source under the MIT licence. One command sets up your own test copy with its own keys.'],
];

export default function Home() {
  return (
    <div className="lp" id="top">
      <StandaloneGate /><Reveal />
      <SiteNav home />

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <a className="lp-pill" href="#security"><span className="dot" />Live with test money<ArrowRight size={14} aria-hidden /></a>
          <h1>Talk to your money.</h1>
          <p className="lp-lead">Pocket, the money app you talk to. Say <q>send Mum 50 dollars and put 25 in Tesla</q>. Pocket makes one clear plan, checks it against your rules, and nothing moves until you hold to approve.</p>
          <div className="lp-ctas"><Cta /><a className="btn ghost big" href="#how">See how it works</a></div>
          <ul className="lp-trust"><li><BadgeCheck size={16} aria-hidden />No seed phrase</li><li><BadgeCheck size={16} aria-hidden />$0 network fees</li><li><BadgeCheck size={16} aria-hidden />You sign every move</li></ul>
        </div>
        <div className="lp-hero-art" aria-hidden>
          <Phone src="/land/wallet.webp" alt="" cls="back" eager />
          <Phone src="/land/chat.webp" alt="Pocket chat showing a plan card" cls="front" eager />
          <div className="float f1"><ShieldCheck size={16} />Within your rules</div>
          <div className="float f2"><Fingerprint size={16} />Hold to approve</div>
        </div>
      </section>

      <section className="lp-strip" aria-label="Built on">
        <span>Built on</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}<img src="/logos/near.svg" alt="NEAR Protocol" height={20} />
        <b>NEAR Intents</b><b>NEAR AI Cloud</b>
        {/* eslint-disable-next-line @next/next/no-img-element */}<img src="/logos/usdc.svg" alt="USDC" height={20} />
      </section>

      <section className="lp-how" id="how" aria-labelledby="how-h">
        <h2 id="how-h" className="rv">Three steps. One of them is you.</h2>
        <ol className="lp-how-steps">{STEPS.map(([t, d], i) => <li key={t} className="rv" style={{ transitionDelay: i * 80 + 'ms' }}><span className="n">{String(i + 1).padStart(2, '0')}</span><b>{t}</b><span>{d}</span></li>)}</ol>
      </section>

      {ROWS.map((r, i) => (
        <section key={r.kick} id={r.id} className={'lp-row' + (i % 2 ? ' flip' : '')} aria-labelledby={'row-' + i}>
          <div className="lp-row-copy rv">
            <span className="kick">{r.kick}</span>
            <h2 id={'row-' + i}>{r.h}</h2>
            <p>{r.p}</p>
            <ul>{r.facts.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
          <div className={'lp-row-art rv' + (r.shots.length > 1 ? ' two' : '')}>
            {r.shots.map(([src, alt]) => <Phone key={src} src={src} alt={alt} />)}
          </div>
        </section>
      ))}

      <section className="lp-safe" id="security" aria-labelledby="safe-h">
        <div className="lp-safe-in">
          <div className="lp-safe-head rv"><span className="kick">Security</span><h2 id="safe-h">AI with your money, but never your keys.</h2><p>Every protection runs in code, on the server and on your device. None of it depends on the AI behaving.</p><a className="lp-link" href={REPO + '/blob/main/docs/POLICY.md'}>Read the security policy<ArrowRight size={16} aria-hidden /></a></div>
          <ol className="lp-safe-list">{SAFE.map(([t, d], i) => <li key={t} className="rv"><span className="n">{String(i + 1).padStart(2, '0')}</span><div><b>{t}</b><p>{d}</p></div></li>)}</ol>
        </div>
      </section>

      <section className="lp-stats" aria-label="Pocket in numbers">
        <div className="rv"><b>$0</b><span>network fees on every send</span></div>
        <div className="rv"><b>2 s</b><span>to settle on NEAR</span></div>
        <div className="rv"><b>1,000</b><span>test dollars to start</span></div>
      </section>

      <section className="lp-faq-sec" id="faq" aria-labelledby="faq-h">
        <h2 id="faq-h" className="rv">Questions, answered plainly.</h2>
        <div className="lp-faq">{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
      </section>

      <section className="lp-band" aria-labelledby="band-h">
        <h2 id="band-h">Try Pocket now.</h2>
        <p>Pick a username and get 1,000 test dollars in under a minute. No download, no seed phrase.</p>
        <div className="lp-ctas"><Cta label="Create your Pocket" /><a className="btn ghost big" href={REPO}>Read the code</a></div>
      </section>

      <SiteFooter />
    </div>
  );
}
