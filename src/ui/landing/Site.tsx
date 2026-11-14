import Link from 'next/link';
import { Coil } from '@/ui/kit';
import { Cta } from './Cta';

export const REPO = 'https://github.com/henrysammarfo/pocket';
const GitHubMark = () => (<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.75.11 3.04.74.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z" /></svg>);
const XMark = () => (<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z" /></svg>);

export function SiteNav({ home = false }: { home?: boolean }) {
  const h = home ? '' : '/';
  return (
    <header className="lp-nav">
      <Link className="lp-brand" href={home ? '#top' : '/'} aria-label="Pocket home"><Coil /><span>Pocket</span></Link>
      <nav aria-label="Sections"><a href={h + '#how'}>How it works</a><a href={h + '#features'}>Features</a><a href={h + '#security'}>Security</a><a href={h + '#faq'}>FAQ</a></nav>
      <Cta label="Try it free" cls="btn lp-navcta" />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="ft">
      <div className="ft-in">
        <div className="ft-brand">
          <Link className="lp-brand" href="/" aria-label="Pocket home"><Coil /><span>Pocket</span></Link>
          <p>The money app you talk to. Built on NEAR.</p>
          <div className="ft-social">
            <a href={REPO} aria-label="Pocket on GitHub"><GitHubMark /></a>
            <a href="https://x.com/hashtag/NEARHackathon" aria-label="#NEARHackathon on X"><XMark /></a>
          </div>
        </div>
        <nav aria-label="Product"><h2>Product</h2><Link href="/welcome">Create your Pocket</Link><Link href="/#how">How it works</Link><Link href="/#features">Features</Link><Link href="/#security">Security</Link><Link href="/#faq">FAQ</Link></nav>
        <nav aria-label="Developers"><h2>Developers</h2><a href={REPO}>Source code</a><a href={REPO + '#one-command-setup-your-own-testnet-copy'}>Run your own copy</a><a href={REPO + '/blob/main/docs/TEST_REPORT.md'}>Test report</a><a href={REPO + '/blob/main/docs/POLICY.md'}>Security policy</a><a href="/api/health">Service status</a></nav>
        <nav aria-label="Hackathon"><h2>Hackathon</h2><a href="https://nearhackathon.com">NEAR Hackathon</a><a href={REPO + '/blob/main/docs/SUBMISSION.md'}>Our submission</a><a href="https://docs.near.ai/cloud/private-inference/">NEAR AI Cloud</a><a href="https://docs.near-intents.org">NEAR Intents</a></nav>
        <nav aria-label="Legal"><h2>Legal</h2><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><a href={REPO + '/blob/main/LICENSE'}>MIT licence</a></nav>
      </div>
      <div className="ft-bot">
        <p>© 2026 Pocket. Pocket runs on NEAR testnet. Test dollars and paper stocks have no real value. Nothing here is financial advice.</p>
        <p>Prices from CoinGecko and Nasdaq.com.</p>
      </div>
    </footer>
  );
}
