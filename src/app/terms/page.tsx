import type { Metadata } from 'next';
import { REPO, SiteFooter, SiteNav } from '@/ui/landing/Site';
import '../landing.css';

export const metadata: Metadata = { title: 'Terms | Pocket', description: 'The terms for using Pocket on NEAR testnet.' };

export default function Terms() {
  return (
    <div className="lp">
      <SiteNav />
      <main className="lp-doc">
        <h1>Terms</h1>
        <p className="upd">Last updated 14 November 2026</p>
        <h2>What Pocket is</h2>
        <p>Pocket is an open source money app that runs on NEAR testnet. It is a working product preview built for the NEAR Hackathon. Test dollars, USDC on testnet, testnet NEAR and paper stock tokens have no real value and cannot be exchanged for real money.</p>
        <h2>Your account and your key</h2>
        <p>When you create a Pocket, a private key is made inside your browser and kept on your device. Pocket never sees it and cannot recover it for you. Back it up from Profile if you want to keep your testnet account.</p>
        <h2>The AI</h2>
        <p>The assistant can answer questions and propose plans. It cannot move money. Every plan is checked against your rules in code and only runs when you press and hold to approve on your own device. Answers can be wrong; check anything important.</p>
        <h2>Not financial advice</h2>
        <p>Nothing in Pocket is financial, investment or tax advice. Prices come from public sources and may be delayed.</p>
        <h2>Fair use</h2>
        <p>Please do not abuse the faucet, the relayer or the AI. Pocket applies rate limits and daily caps, and may block accounts that try to get around them.</p>
        <h2>No warranty</h2>
        <p>Pocket is provided as is, under the <a href={REPO + '/blob/main/LICENSE'}>MIT licence</a>, without warranty of any kind.</p>
        <h2>Contact</h2>
        <p>Questions or problems: open an issue on <a href={REPO + '/issues'}>GitHub</a>.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
