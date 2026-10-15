import { createFileRoute, Link } from "@tanstack/react-router";
import { LandChrome } from "@/components/marketing/LandChrome";

export const Route = createFileRoute("/product")({
  head: () => ({
    meta: [
      { title: "Features — POCKET" },
      {
        name: "description",
        content: "Everything starts with a plan you approve. Structured money plans, clear status, fail-closed control.",
      },
      { property: "og:title", content: "POCKET Features" },
      { property: "og:description", content: "Plain language in. Policy-checked settlement out." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Product,
});

const FEATURES = [
  {
    icon: "/brand/landing/note.svg",
    title: "Structured money plans",
    body: "Turn a simple sentence into clear actions, amounts, and conditions you can review before anything moves.",
  },
  {
    icon: "/brand/landing/transfer.svg",
    title: "Supported token movements",
    body: "Access supported crypto-token features where network integrations are available — surface stays plain English.",
  },
  {
    icon: "/brand/landing/wave.svg",
    title: "Clear plan status",
    body: "Know whether an action is waiting, completed, blocked, or needs attention.",
  },
  {
    icon: "/brand/landing/security-check.svg",
    title: "Fail-closed Keep",
    body: "Your reserve floor is permission. “Send the rest” cannot spend past Keep.",
  },
  {
    icon: "/brand/landing/list-checks.svg",
    title: "Review before approve",
    body: "See payees, amounts, and conditions in a structured card — then Approve or Edit.",
  },
  {
    icon: "/brand/landing/license.svg",
    title: "Readable receipts",
    body: "Settlements and blocks show up as plain-English history from Envio + POCKET.",
  },
];

function Product() {
  return (
    <LandChrome active="features">
      <section className="bb-land-section bb-land-center">
        <p className="bb-land-kicker">
          <i aria-hidden />
          Features
        </p>
        <h2>Everything starts with a plan you approve.</h2>
        <p className="bb-land-lead">
          POCKET connects your instructions to structured actions, so you can understand what is intended.
        </p>
        <div className="bb-land-cards" style={{ marginTop: 48 }}>
          {FEATURES.map((f) => (
            <article key={f.title} className="bb-land-card">
              <span className="bb-land-ico">
                <img src={f.icon} alt="" width={24} height={24} />
              </span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bb-land-cta-band">
        <p className="bb-land-kicker">
          <i aria-hidden />
          Start with a plan
        </p>
        <h2>Make your plan clear before your money moves.</h2>
        <p>Put your instructions into a plan you can review, understand, and approve.</p>
        <div className="bb-land-actions">
          <Link to="/app" className="pk-btn-primary">
            Get started
          </Link>
          <a href="/#how" className="bb-btn-ghost">
            How it works
          </a>
        </div>
      </section>
    </LandChrome>
  );
}
