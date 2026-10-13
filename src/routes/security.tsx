import { createFileRoute } from "@tanstack/react-router";
import { Ban, Clock3, ListChecks, ShieldCheck } from "lucide-react";
import { BlockedMock, CtaBand, FeatureGrid, PageHero, PrimaryLink, PromptMock, SectionHead } from "@/components/marketing/Kit";
import { StudioFooter } from "@/components/StudioFooter";

export const Route = createFileRoute("/security")({ head: () => ({ meta: [{title:"Safety — POCKET guardrails"},{name:"description",content:"POCKET checks spending caps, allowlists, reserves, and expiry before any plan can settle."},{property:"og:title",content:"POCKET safety rules"},{property:"og:description",content:"Money rules that fail closed, not open."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}] }), component: Security });

function Security() {
  return (
    <>
      <main className="mk-page">
        <PageHero eyebrow="Fail closed by design" title={<>Rules <em>before</em> movement.</>} copy="POCKET doesn't ask you to trust a warning. A plan outside your rules can't be approved." aside={<div className="mk-stage"><PromptMock text="Spend $145 on the weekend." /><BlockedMock /></div>}>
          <PrimaryLink to="/app">Set your rules</PrimaryLink>
        </PageHero>
        <section>
          <SectionHead eyebrow="Four guardrails" title="Boundaries that hold." />
          <FeatureGrid cols={2} items={[
            { icon: ShieldCheck, kicker: "Protected reserve", title: "Keep your floor", copy: "Set a minimum balance that stays untouched after every plan." },
            { icon: ListChecks, kicker: "Allowlist", title: "Know every route", copy: "Choose who and what a plan may pay. Unknown destinations are refused." },
            { icon: Clock3, kicker: "Expiry", title: "No stale approvals", copy: "Plans expire automatically, so old intent never becomes a surprise." },
            { icon: Ban, kicker: "Fail closed", title: "One broken rule blocks every leg", copy: "No partial payment. No stray buy. No silent fallback.", tone: "danger" },
          ]} />
        </section>
        <CtaBand title="Set the boundary. Then make the plan." copy="Try breaking a rule in the demo and watch it stop." to="/app" label="Try the demo" />
      </main>
      <StudioFooter />
    </>
  );
}
