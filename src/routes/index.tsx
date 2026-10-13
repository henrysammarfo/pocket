import { createFileRoute } from "@tanstack/react-router";
import { Ban, Braces, Combine, FileCheck2, ShieldCheck, WalletCards } from "lucide-react";
import { ApprovalMock, BlockedMock, CtaBand, FeatureGrid, GhostLink, LoaderMock, PageHero, PrimaryLink, PromptMock, ReceiptMock, SectionHead } from "@/components/marketing/Kit";
import { receipts } from "@/data/site";
import { StudioFooter } from "@/components/StudioFooter";

export const Route = createFileRoute("/")({ head: () => ({ meta: [{title:"POCKET — Money plans that cannot overspend"},{name:"description",content:"Plan your money in plain English. POCKET pays and buys on Monad inside rules that refuse to break."},{property:"og:title",content:"POCKET — Money plans that cannot overspend"},{property:"og:description",content:"One plan. One approval. Rules that refuse to break."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary_large_image"}] }), component: Home });

function Home() {
  return (
    <>
      <main className="mk-page">
        <PageHero eyebrow="Monad testnet · Demo" title={<>Money plans that <em>cannot</em> overspend.</>} copy="Tell POCKET what your money should do. It pays, buys, and keeps every move inside your rules." aside={<div className="mk-stage"><PromptMock /><LoaderMock /><ApprovalMock /></div>}>
          <PrimaryLink to="/app">Start a plan</PrimaryLink>
          <GhostLink to="/product">How it works</GhostLink>
        </PageHero>
        <section>
          <SectionHead eyebrow="One invisible flow" title={<>Say the plan.<br />POCKET does the math.</>} copy="Five systems run behind one sentence, so you only make one decision." />
          <FeatureGrid items={[
            { icon: WalletCards, kicker: "01 · Tell", title: "Plain English in", copy: "Describe the plan by typing or speaking. No seed phrase, no app-hopping." },
            { icon: ShieldCheck, kicker: "02 · Check", title: "Rules check first", copy: "Caps, recipients, reserves and expiry are checked before anything can move." },
            { icon: FileCheck2, kicker: "03 · Approve", title: "Approve once", copy: "Every leg settles together, then leaves a receipt you can actually read." },
          ]} />
        </section>
        <section className="mk-split">
          <div><SectionHead eyebrow="Built to refuse" title={<>Overspend is not a warning. It is a stop.</>} copy="If one leg breaks a rule, the whole plan is refused. No partial payment, no stray buy." /><GhostLink to="/security">See the safety rules</GhostLink></div>
          <div className="mk-stage"><PromptMock text="Buy the $145 sneakers this weekend." /><BlockedMock /></div>
        </section>
        <section className="mk-split">
          <div className="mk-stage"><ReceiptMock rows={[...receipts]} /></div>
          <div><SectionHead eyebrow="Readable proof" title="Every outcome leaves a receipt." copy="Settled or blocked, you see what happened and why. Sample records shown." /><GhostLink to="/activity">View sample activity</GhostLink></div>
        </section>
        <section>
          <SectionHead eyebrow="Under the hood" title="Serious systems. Simple surface." />
          <FeatureGrid cols={4} items={[
            { icon: Braces, kicker: "Parser", title: "Exact fields", copy: "Amounts, dates and recipients from one sentence." },
            { icon: ShieldCheck, kicker: "Policy", title: "Fail closed", copy: "Anything outside your rules never runs." },
            { icon: Combine, kicker: "Composer", title: "One settlement", copy: "Payment and market legs move together." },
            { icon: Ban, kicker: "Honest", title: "Testnet only", copy: "A demo today. No real funds move.", tone: "danger" },
          ]} />
        </section>
        <CtaBand title={<>Your intent is the brief.<br />Your rules are the boundary.</>} copy="Open POCKET and describe your first money goal." to="/app" label="Open POCKET" />
      </main>
      <StudioFooter />
    </>
  );
}
