import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Github, MessageCircle } from "lucide-react";
import { PageHero } from "@/components/marketing/Kit";
import { StudioFooter } from "@/components/StudioFooter";

export const Route = createFileRoute("/contact")({ head: () => ({ meta: [{title:"Contact — POCKET"},{name:"description",content:"Talk to POCKET about partnerships, early access, and the Monad testnet demo."},{property:"og:title",content:"Contact POCKET"},{property:"og:description",content:"Partners, testers, and money-plan thinkers welcome."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}] }), component: Contact });

function Contact() {
  return (
    <>
      <main className="mk-page">
        <PageHero eyebrow="Partners · Testers · Builders" title={<>Let's move money <em>better</em>.</>} copy="Interested in payments, safe money assistants, or the testnet build? Reach Henry directly." aside={<div className="mk-contact">
          <a href="https://x.com/henrysammarfo" target="_blank" rel="noreferrer"><span><small>X / Twitter</small><strong>@henrysammarfo</strong></span><MessageCircle aria-hidden /></a>
          <a href="https://github.com/henrysammarfo" target="_blank" rel="noreferrer"><span><small>GitHub</small><strong>henrysammarfo</strong></span><Github aria-hidden /></a>
          <Link to="/app"><span><small>Product</small><strong>Open the demo</strong></span><ArrowUpRight aria-hidden /></Link>
        </div>} />
      </main>
      <StudioFooter />
    </>
  );
}
