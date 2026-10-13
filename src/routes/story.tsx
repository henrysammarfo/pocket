import { createFileRoute } from "@tanstack/react-router";
import { CtaBand, PageHero, SectionHead } from "@/components/marketing/Kit";
import { StudioFooter } from "@/components/StudioFooter";

export const Route = createFileRoute("/story")({ head: () => ({ meta: [{title:"History — The POCKET story"},{name:"description",content:"Why POCKET turns plain-language money plans into actions that cannot overspend."},{property:"og:title",content:"The POCKET story"},{property:"og:description",content:"Money software should understand the plan and respect its boundaries."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}] }), component: Story });

function Story() {
  return (
    <>
      <main className="mk-page">
        <PageHero eyebrow="History · Accra to everywhere" title={<>A plan should be <em>stronger</em> than an impulse.</>} copy="POCKET began with a plain observation: people know what they want their money to do, but today's tools make them coordinate every step themselves." />
        <section>
          <SectionHead eyebrow="Three chapters" title="How POCKET came to be." />
          <div className="mk-timeline">
            {[["01 · Friction", "The tab parade", "One goal turns into tabs, transfers, reminders and chances to spend past what you meant."],["02 · Reframe", "A sentence is a plan", "Instead of another money chatbot, POCKET treats your full sentence as a plan with amounts, timing and limits."],["03 · Promise", "Pass or nothing moves", "Convenience comes from coordination. Confidence comes from refusal."]].map(([n, t, c]) => <article key={n}><span>{n}</span><h3>{t}</h3><p>{c}</p></article>)}
          </div>
        </section>
        <CtaBand title="The next chapter is in the lab." copy="See the systems being proven right now." to="/lab" label="See development" />
      </main>
      <StudioFooter />
    </>
  );
}
