import { createFileRoute } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { CtaBand, PageHero, ReceiptMock } from "@/components/marketing/Kit";
import { receipts } from "@/data/site";
import { StudioFooter } from "@/components/StudioFooter";

export const Route = createFileRoute("/activity")({ head: () => ({ meta: [{title:"Activity — POCKET testnet receipts"},{name:"description",content:"Explore clearly labeled sample POCKET receipts and blocked plan records."},{property:"og:title",content:"POCKET activity and receipts"},{property:"og:description",content:"Readable proof for every plan result."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}] }), component: ActivityPage });

function ActivityPage() {
  return (
    <>
      <main className="mk-page">
        <PageHero eyebrow="Sample activity · Testnet demo" title={<>Every outcome leaves a <em>receipt</em>.</>} copy="Settled or blocked, POCKET gives you one readable record of what happened and why." aside={<div className="mk-stage"><ReceiptMock rows={[...receipts]} /></div>} />
        <div className="mk-note"><Info aria-hidden /><p><strong>Sample records only.</strong> Explorer links turn on when live Monad testnet execution is connected.</p></div>
        <CtaBand title="Clear enough to read. Exact enough to verify." copy="Make a plan and get your own receipt." to="/app" label="Open POCKET" />
      </main>
      <StudioFooter />
    </>
  );
}
