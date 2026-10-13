import { createFileRoute } from "@tanstack/react-router";
import { Compass, MessageSquareOff, UserRound } from "lucide-react";
import { CtaBand, FeatureGrid, PageHero, PrimaryLink, GhostLink, SectionHead } from "@/components/marketing/Kit";
import { StudioFooter } from "@/components/StudioFooter";

export const Route = createFileRoute("/about")({ head: () => ({ meta: [{title:"About — POCKET"},{name:"description",content:"POCKET is a consumer money planning product built in Accra for people everywhere."},{property:"og:title",content:"About POCKET"},{property:"og:description",content:"A money plan that cannot overspend."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}] }), component: About });

function About() {
  return (
    <>
      <main className="mk-page">
        <PageHero eyebrow="About · Made in Accra" title={<>Money software should <em>understand</em> the plan.</>} copy="People think in outcomes, not in a chain of apps. POCKET gives that intent a safe path to happen.">
          <PrimaryLink to="/app">Try POCKET</PrimaryLink>
          <GhostLink to="/story">Read our story</GhostLink>
        </PageHero>
        <section>
          <SectionHead eyebrow="What we believe" title="Convenience without surrender." />
          <FeatureGrid items={[
            { icon: Compass, kicker: "The belief", title: "Rules lead, action follows", copy: "A money assistant only works when it can't quietly outrun your limits." },
            { icon: MessageSquareOff, kicker: "The difference", title: "Not another chat wrapper", copy: "The point is a coordinated plan that either settles inside your rules or doesn't settle." },
            { icon: UserRound, kicker: "Founder", title: "Henry Sam Marfo", copy: "Building POCKET for Monad Metropolis 2026, with ambitions well beyond the demo." },
          ]} />
        </section>
        <CtaBand title="Built in Accra. Designed for everywhere." copy="See what we're building right now." to="/lab" label="Inside the lab" />
      </main>
      <StudioFooter />
    </>
  );
}
