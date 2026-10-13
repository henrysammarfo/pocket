import { createFileRoute } from "@tanstack/react-router";
import { Braces, Combine, FileCheck2, FlaskConical, ShieldCheck } from "lucide-react";
import { CtaBand, FeatureGrid, LoaderMock, PageHero, SectionHead } from "@/components/marketing/Kit";
import { StudioFooter } from "@/components/StudioFooter";

export const Route = createFileRoute("/lab")({ head: () => ({ meta: [{title:"Development — POCKET in the lab"},{name:"description",content:"Explore the policy, composition, settlement, and receipt work behind the POCKET testnet demo."},{property:"og:title",content:"Inside the POCKET lab"},{property:"og:description",content:"The working ideas behind a money plan that cannot overspend."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}] }), component: Lab });

function Lab() {
  return (
    <>
      <main className="mk-page">
        <PageHero eyebrow="Development · Monad testnet" title={<>The hard work sits behind <em>one</em> sentence.</>} copy="These are the systems being proven in the POCKET demo. Remove the composer or the rules engine and the product stops working." aside={<div className="mk-stage"><LoaderMock label="Composing settlement" /><LoaderMock label="Indexing receipt" /></div>} />
        <section>
          <SectionHead eyebrow="Work in progress" title="Four systems, one promise." />
          <FeatureGrid cols={2} items={[
            { icon: Braces, kicker: "Parsing", title: "Human intent, exact fields", copy: "Recipients, dates, floors, caps and market instructions from one plan." },
            { icon: ShieldCheck, kicker: "Policy", title: "Fail closed by default", copy: "Low balance, unknown recipient, expired approval or a broken cap stops everything." },
            { icon: Combine, kicker: "Composition", title: "Many legs, one decision", copy: "Agora payments and Kuru market actions prepared as one Monad settlement." },
            { icon: FileCheck2, kicker: "Proof", title: "Readable after the fact", copy: "Indexed receipts explain both settled actions and blocked attempts." },
          ]} />
        </section>
        <div className="mk-note"><FlaskConical aria-hidden /><p><strong>Current state.</strong> This site shows the full interaction with sample data. It does not claim real settlement or a connected wallet yet.</p></div>
        <CtaBand title="Run the clickable demo." copy="Describe a goal and watch the plan take shape." to="/app" label="Open POCKET" />
      </main>
      <StudioFooter />
    </>
  );
}
