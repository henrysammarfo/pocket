import { createFileRoute, Link } from "@tanstack/react-router";
import { LandChrome } from "@/components/marketing/LandChrome";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — POCKET" },
      {
        name: "description",
        content: "POCKET is a consumer money planning product. An approved plan is the only permission.",
      },
      { property: "og:title", content: "About POCKET" },
      { property: "og:description", content: "A money plan that cannot overspend." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: About,
});

function About() {
  return (
    <LandChrome active="about">
      <section className="bb-land-section bb-land-center">
        <p className="bb-land-kicker">
          <i aria-hidden />
          About
        </p>
        <h2>Money software should understand the plan.</h2>
        <p className="bb-land-lead">
          People think in outcomes, not in a chain of apps. POCKET gives that intent a safe path — and stops when it
          would overspend.
        </p>
        <div className="bb-land-cards" style={{ marginTop: 48 }}>
          <article className="bb-land-card">
            <span className="bb-land-ico">
              <img src="/brand/landing/shield.svg" alt="" width={24} height={24} />
            </span>
            <h3>Rules lead, action follows</h3>
            <p>A money assistant only works when it cannot quietly outrun your limits.</p>
          </article>
          <article className="bb-land-card">
            <span className="bb-land-ico">
              <img src="/brand/landing/note.svg" alt="" width={24} height={24} />
            </span>
            <h3>Not another chat wrapper</h3>
            <p>The point is a coordinated plan that either settles inside your rules or does not settle.</p>
          </article>
          <article className="bb-land-card">
            <span className="bb-land-ico">
              <img src="/brand/landing/wave.svg" alt="" width={24} height={24} />
            </span>
            <h3>Built for everyday decisions</h3>
            <p>ChatGPT-simple surface. Crypto stays under the hood on Monad testnet.</p>
          </article>
        </div>
      </section>

      <section className="bb-land-cta-band">
        <p className="bb-land-kicker">
          <i aria-hidden />
          Try it
        </p>
        <h2>Review first. Approve before anything moves.</h2>
        <p>Open POCKET and create a plan in plain English.</p>
        <div className="bb-land-actions">
          <Link to="/app" className="pk-btn-primary">
            Open POCKET
          </Link>
          <Link to="/product" className="bb-btn-ghost">
            Features
          </Link>
        </div>
      </section>
    </LandChrome>
  );
}
