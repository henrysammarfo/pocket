import type { Metadata } from 'next';
import { ArrowRight, BadgeCheck, Camera, ChartLine, Fingerprint, Globe, KeyRound, Lock, MessageCircle, Mic, ReceiptText, Send, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { Cta, Reveal, StandaloneGate } from '@/ui/landing/Cta';
import { Coil } from '@/ui/kit';
import './landing.css';

export const metadata: Metadata = {
  title: 'Pocket, the money app you talk to',
  description: 'Say what your money should do. Pocket turns it into one plan, checks it against your rules, and nothing moves until you hold to approve. Live on NEAR testnet.',
};

const REPO = 'https://github.com/henrysammarfo/pocket';
const Phone = ({ src, alt, cls = '' }: { src: string; alt: string; cls?: string }) => (
  <div className={'ph ' + cls}><div className="ph-scr">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={src} alt={alt} width={390} height={844} /></div><span className="ph-isl" /></div>
);

const FEATURES = [
  { i: MessageCircle, t: 'Chat about anything', d: 'Small talk, budgets, plans. Ask what you spent, what Tesla is at, or what is in the news today. Pocket answers with live data and real sources.' },
  { i: Mic, t: 'Talk the way you talk', d: 'Hold the mic or send a voice note. Ums, repeats, accents and Pidgin are fine. Pocket says back what it heard before anything happens.' },
  { i: Camera, t: 'Snap a bill, split it', d: 'Share a photo of a receipt or bill. Pocket reads the items and total, and turns "split it with Ama" into a plan card.' },
  { i: Send, t: 'Send to anyone, gas free', d: 'Pay a @username, a saved name or any NEAR account. Share your pay link. Pocket covers the network fee.' },
  { i: ChartLine, t: 'Paper stocks, live prices', d: 'Practise with Tesla, NVIDIA, Apple, S&P 500 and Nasdaq 100 tokens priced live. Every quote shows its spread and source.' },
  { i: ReceiptText, t: 'A receipt for every move', d: 'Each send and trade gets a public receipt rebuilt from the chain, with a link to the block explorer.' },
];
const FAQ = [
  ['Is this real money?', 'No. Pocket runs on NEAR testnet. You get 1,000 test dollars when you join, and the stock tokens are paper. Nothing here has real value, so it is a safe place to learn.'],
  ['Do I need a wallet, an email or a seed phrase?', 'No. Pick a username and Pocket makes a private key inside your browser, creates your NEAR testnet account and pays the gas. You can back the key up from Profile and add a passkey in Settings.'],
  ['Does Pocket use Privy or another login service?', 'No. There is no third party login. Your key is made and kept on your own device, which is why Pocket can never move money without you. A passkey (Face ID, fingerprint or screen lock) can guard every approval.'],
  ['Can the AI move my money?', 'No. The AI can only propose a plan card. Your rules are checked in code, and nothing moves until you press and hold to approve on your own device. Instructions hidden in pasted text or photos are ignored.'],
  ['What can I ask it?', 'Anything you would ask a smart friend: send money, split a bill, buy a paper stock, check prices, ask about today, find a product, or just chat. It remembers what you ask it to.'],
  ['What does it cost?', 'Pocket is free while on testnet, with 1,000 AI credits a month. Sends cost you nothing; Pocket pays the network fee.'],
  ['Can I run my own copy?', 'Yes. The code is open source under the MIT licence. One command sets up your own testnet copy with its own keys.'],
];

export default function Home() {
  return (
    <div className="lp" id="top">
      <StandaloneGate /><Reveal />
      <header className="lp-nav">
        <a className="lp-brand" href="#top" aria-label="Pocket home"><Coil /><span>Pocket</span></a>
        <nav aria-label="Sections"><a href="#how">How it works</a><a href="#features">Features</a><a href="#security">Security</a><a href="#faq">FAQ</a></nav>
        <Cta label="Try it free" cls="btn lp-navcta" />
      </header>

      <section className="lp-hero">
        <div className="lp-hero-copy">
          <a className="lp-pill" href="#security"><span className="dot" />Live on NEAR testnet<ArrowRight size={14} aria-hidden /></a>
          <h1>Talk to your money.</h1>
          <p className="lp-lead">Pocket, the money app you talk to. Say <q>send Mum 50 dollars and put 25 in Tesla</q>. Pocket makes one clear plan, checks it against your rules, and nothing moves until you hold to approve.</p>
          <div className="lp-ctas"><Cta /><a className="btn ghost big" href="#how">See how it works</a></div>
          <ul className="lp-trust"><li><BadgeCheck size={16} aria-hidden />No seed phrase</li><li><BadgeCheck size={16} aria-hidden />$0 network fees</li><li><BadgeCheck size={16} aria-hidden />You sign every move</li></ul>
        </div>
        <div className="lp-hero-art" aria-hidden>
          <div className="glow" />
          <Phone src="/land/wallet.webp" alt="" cls="back" />
          <Phone src="/land/chat.webp" alt="Pocket chat showing a plan card" cls="front" />
          <div className="float f1"><ShieldCheck size={16} />Within your rules</div>
          <div className="float f2"><Fingerprint size={16} />Hold to approve</div>
        </div>
      </section>

      <section className="lp-strip rv" aria-label="Built on">
        <span>Built on</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}<img src="/logos/near.svg" alt="NEAR Protocol" height={22} />
        <b>NEAR Intents</b><b>Meta transactions</b>
        {/* eslint-disable-next-line @next/next/no-img-element */}<img src="/logos/usdc.svg" alt="USDC" height={22} />
        <b>Open source, MIT</b>
      </section>

      <section className="lp-sec" id="how">
        <div className="lp-head rv"><span className="kick">How it works</span><h2>Three steps. One of them is you.</h2><p>Pocket does the busy work. You stay in charge of every dollar.</p></div>
        <div className="lp-steps">
          <article className="rv"><span className="n">1</span><h3>Say it</h3><p>Type, talk or share a photo. Pocket works out who, how much and what.</p><Phone src="/land/photo.webp" alt="Pocket reading a dinner bill" /></article>
          <article className="rv"><span className="n">2</span><h3>Check the plan</h3><p>One card with every step, checked in code against your daily limit and the money you always keep.</p><Phone src="/land/chat.webp" alt="A plan card within your rules" /></article>
          <article className="rv"><span className="n">3</span><h3>Hold to approve</h3><p>Press and hold. Your device key signs the exact amounts. It settles on NEAR in seconds with a receipt.</p><Phone src="/land/review.webp" alt="The hold to approve screen" /></article>
        </div>
      </section>

      <section className="lp-sec lp-flow-sec" aria-label="What happens when you ask">
        <div className="lp-head rv"><span className="kick">Under the hood</span><h2>The AI proposes. Code checks. You decide.</h2></div>
        <ol className="lp-flow rv">
          <li><MessageCircle size={18} aria-hidden /><b>You ask</b><span>Text, voice or photo</span></li>
          <li><Sparkles size={18} aria-hidden /><b>AI drafts a plan</b><span>It has no keys</span></li>
          <li><ShieldCheck size={18} aria-hidden /><b>Rules check</b><span>Limits and keep, in code</span></li>
          <li><Fingerprint size={18} aria-hidden /><b>You hold</b><span>Device key signs</span></li>
          <li><Globe size={18} aria-hidden /><b>NEAR settles</b><span>Gas paid, atomic trades</span></li>
          <li><ReceiptText size={18} aria-hidden /><b>Receipt</b><span>Rebuilt from chain</span></li>
        </ol>
      </section>

      <section className="lp-sec" id="features">
        <div className="lp-head rv"><span className="kick">Features</span><h2>Everything money, in one conversation.</h2></div>
        <div className="lp-bento">
          {FEATURES.map(({ i: I, t, d }) => <article key={t} className="rv"><span className="ic"><I size={20} aria-hidden /></span><h3>{t}</h3><p>{d}</p></article>)}
          <article className="wide rv"><div><span className="ic"><Users size={20} aria-hidden /></span><h3>Built for families who live far apart</h3><p>Pocket starts with the people who send money home every month. Names instead of addresses, plain words instead of jargon, and a phone first design that works on any screen.</p></div><Phone src="/land/products.webp" alt="Pocket showing product results" /></article>
        </div>
      </section>

      <section className="lp-sec lp-sec-dark" id="security">
        <div className="lp-head rv"><span className="kick">Security</span><h2>AI with your money, but never your keys.</h2><p>Every protection runs in code, on the server and on your device. None of it depends on the AI behaving.</p></div>
        <div className="lp-sgrid">
          <article className="rv"><KeyRound size={20} aria-hidden /><h3>Your key stays with you</h3><p>Made in your browser, never sent anywhere. Back it up, restore it, or sign out to remove it.</p></article>
          <article className="rv"><Lock size={20} aria-hidden /><h3>Rules that hold</h3><p>Daily send limit and an always keep amount, enforced by the server. Raising a limit needs your signature and passkey.</p></article>
          <article className="rv"><Fingerprint size={20} aria-hidden /><h3>Passkey approvals</h3><p>Turn on Face ID, fingerprint or screen lock so every hold to approve needs you, not just your phone.</p></article>
          <article className="rv"><ShieldCheck size={20} aria-hidden /><h3>A relayer with a policy</h3><p>Pocket only pays gas for allowed calls, caps NEAR sends, and refuses its own service accounts.</p></article>
          <article className="rv"><Sparkles size={20} aria-hidden /><h3>Prompt injection tested</h3><p>An attack suite tries to trick the agent and the relayer on every release. Every attack must be refused.</p></article>
          <article className="rv"><Globe size={20} aria-hidden /><h3>Testnet only</h3><p>Test dollars and paper stocks with no real value, on the unmodified NEAR Intents verifier.</p></article>
        </div>
      </section>

      <section className="lp-band rv">
        <div><h2>Try Pocket now.</h2><p>Pick a username and get 1,000 test dollars in under a minute. No download, no seed phrase.</p></div>
        <div className="lp-ctas"><Cta label="Create your Pocket" /><a className="btn ghost big" href={REPO}>Read the code</a></div>
      </section>

      <section className="lp-sec" id="faq">
        <div className="lp-head rv"><span className="kick">FAQ</span><h2>Questions, answered plainly.</h2></div>
        <div className="lp-faq">{FAQ.map(([q, a]) => <details key={q} className="rv"><summary>{q}</summary><p>{a}</p></details>)}</div>
      </section>

      <footer className="lp-foot">
        <div className="lp-foot-top">
          <div className="lp-foot-brand"><a className="lp-brand" href="#top"><Coil /><span>Pocket</span></a><p>Pocket, the money app you talk to. Live on NEAR testnet.</p></div>
          <nav aria-label="Product"><b>Product</b><a href="/welcome">Create your Pocket</a><a href="#how">How it works</a><a href="#features">Features</a><a href="#security">Security</a><a href="#faq">FAQ</a></nav>
          <nav aria-label="Developers"><b>Developers</b><a href={REPO}>GitHub</a><a href={REPO + '#readme'}>README</a><a href={REPO + '/blob/main/docs/TEST_REPORT.md'}>Test report</a><a href={REPO + '/blob/main/SECURITY.md'}>Security model</a><a href="/api/health">Service health</a></nav>
          <nav aria-label="About"><b>About</b><a href={REPO + '/blob/main/docs/BUSINESS.md'}>Business model</a><a href={REPO + '/blob/main/LICENSE'}>MIT licence</a><a href="https://near.org">NEAR Protocol</a></nav>
        </div>
        <div className="lp-foot-bot"><span>© 2026 Pocket. Testnet only. Test money has no value. Not financial advice.</span><span>Market data: CoinGecko, Nasdaq.com.</span></div>
      </footer>
    </div>
  );
}
