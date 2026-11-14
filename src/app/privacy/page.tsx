import type { Metadata } from 'next';
import { REPO, SiteFooter, SiteNav } from '@/ui/landing/Site';
import '../landing.css';

export const metadata: Metadata = { title: 'Privacy | Pocket', description: 'What Pocket stores, what it never stores, and where the AI runs.' };

export default function Privacy() {
  return (
    <div className="lp">
      <SiteNav />
      <main className="lp-doc">
        <h1>Privacy</h1>
        <p className="upd">Last updated 14 November 2026</p>
        <h2>What stays on your device</h2>
        <ul><li>Your private key. It is made in your browser and never sent to Pocket.</li><li>Your app settings, such as theme and spoken replies.</li></ul>
        <h2>What Pocket stores</h2>
        <ul>
          <li>Your username, first name and NEAR testnet account name.</li>
          <li>Your chat history and the facts you ask Pocket to remember, saved to your account behind a signed session. You can delete chats and memories at any time.</li>
          <li>Your daily limit, keep amount and AI credit use.</li>
          <li>Public testnet transactions, which anyone can see on the NEAR explorer.</li>
        </ul>
        <h2>What Pocket never stores</h2>
        <ul><li>Private keys, seed phrases or passwords. The assistant refuses to save them.</li><li>Photos you share. They are read once and discarded.</li><li>Voice recordings. They are turned into text and discarded.</li></ul>
        <h2>Where the AI runs</h2>
        <p>Chats, photos and voice notes are processed by private models on <a href="https://docs.near.ai/cloud/private-inference/">NEAR AI Cloud</a>, inside attested secure hardware (Intel TDX and NVIDIA confidential computing), so the host cannot read them. Anyone can check the attestation with <code>npm run verify:tee</code>. If NEAR AI is unavailable, Pocket falls back to Groq. Live web searches go through Groq.</p>
        <h2>No tracking</h2>
        <p>Pocket has no ads, no analytics trackers and no third party login.</p>
        <h2>Contact</h2>
        <p>Questions: open an issue on <a href={REPO + '/issues'}>GitHub</a>.</p>
      </main>
      <SiteFooter />
    </div>
  );
}
