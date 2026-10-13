import { createFileRoute } from "@tanstack/react-router";
import { Braces, Combine, FileCheck2, ShieldCheck, WalletCards } from "lucide-react";
import { ApprovalMock, CtaBand, FeatureGrid, PageHero, PrimaryLink, PromptMock, SectionHead, LoaderMock } from "@/components/marketing/Kit";
import { StudioFooter } from "@/components/StudioFooter";

export const Route = createFileRoute("/product")({ head: () => ({ meta: [{title:"Product — How POCKET works"},{name:"description",content:"See how POCKET turns one plain-English money plan into policy-checked payments and buys."},{property:"og:title",content:"How POCKET works"},{property:"og:description",content:"Plain language in. Policy-checked settlement out."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}] }), component: Product });

function Product() {
  return (
    <>
      <main className="mk-page">
        <PageHero eyebrow="The product" title={<>One sentence. <em>One</em> safe settlement.</>} copy="POCKET turns what you want into exact money actions, then checks every one before it can move." aside={<div className="mk-stage"><PromptMock /><LoaderMock label="Parsing your plan" /><ApprovalMock /></div>}>
          <PrimaryLink to="/app">Build a demo plan</PrimaryLink>
        </PageHero>
        <section>
          <SectionHead eyebrow="Five stages" title="From plan to proof." />
          <div className="mk-timeline">
            {[["01", "Invisible start", "Say what your money should do. A testnet wallet is set up for you, with no seed phrase to manage."],["02", "Plan parser", "Your sentence becomes exact recipients, amounts, dates, reserves and market instructions."],["03", "Policy engine", "Every leg must meet your caps, allowlist, balance and expiry, or the whole plan stops."],["04", "Intent composer", "Approved payment and market legs become one coordinated Monad settlement."],["05", "Receipt", "Indexed proof makes every result readable and easy to check later."]].map(([n, t, c]) => <article key={n}><span>{n}</span><h3>{t}</h3><p>{c}</p></article>)}
          </div>
        </section>
        <section>
          <SectionHead eyebrow="What you get" title="Less coordinating. More confidence." />
          <FeatureGrid items={[
            { icon: WalletCards, kicker: "Simple", title: "Talk or type", copy: "Speak your goal with the mic or type it, just like messaging a friend." },
            { icon: ShieldCheck, kicker: "Safe", title: "Your rules win", copy: "Limits you set are hard limits, not reminders." },
            { icon: Combine, kicker: "Together", title: "All or nothing", copy: "Plans settle as one, so nothing is left half-done." },
          ]} />
        </section>
        <CtaBand title="Try a plan in seconds." copy="It's a demo on testnet, so experiment freely." to="/app" label="Open POCKET" />
      </main>
      <StudioFooter />
    </>
  );
}
