import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "POCKET — Your money. Your rules." },
      {
        name: "description",
        content:
          "Create a money plan, review every movement, and approve it before POCKET acts. Your approved plan sets the limits.",
      },
      { property: "og:title", content: "POCKET — Your money. Your rules." },
      {
        property: "og:description",
        content: "Smart way to manage your money. Review first. Approve before anything moves.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const PROBLEMS = [
  {
    icon: "/brand/landing/list-checks.svg",
    title: "Instructions get scattered",
    body: "Your intentions can end up spread across different tools, messages, and transactions.",
  },
  {
    icon: "/brand/landing/security-check.svg",
    title: "Limits need to stay clear",
    body: "A plan should mean something. Its approved amounts and recipients should not change.",
  },
  {
    icon: "/brand/landing/license.svg",
    title: "You need to know what happened",
    body: "See the outcome of a movement and understand when an action was blocked.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Start with what you want to do.",
    body: "Write your intended payments, the amount you want to keep, and what should happen with the rest.",
    phone: "/brand/landing/phone-step1.png",
  },
  {
    n: "2",
    title: "See the plan before anything moves.",
    body: "POCKET turns your instructions into clear actions, amounts, and conditions. Review the details always.",
    phone: "/brand/landing/phone-step2.png",
  },
  {
    n: "3",
    title: "Know what happens next.",
    body: "Follow the status of your plan. Understand why an action may be blocked.",
    phone: "/brand/landing/phone-step3.png",
  },
];

const FEATURES = [
  {
    icon: "/brand/landing/note.svg",
    title: "Structured money plans",
    body: "Turn a simple sentence into clear actions, amounts, and conditions you can review.",
  },
  {
    icon: "/brand/landing/transfer.svg",
    title: "Supported token movements",
    body: "Access supported crypto-token features where network integrations are available.",
  },
  {
    icon: "/brand/landing/wave.svg",
    title: "Clear plan status",
    body: "Know whether an action is waiting, completed, blocked, or needs attention.",
  },
];

const CONTROL_POINTS = [
  "Approved amounts stay within their limits.",
  "New payees cannot be added through a later instruction",
  "An action that breaks the plan is blocked instead of silently proceeding",
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "What is POCKET?",
    a: "POCKET is a plain-English money assistant. You describe what your money should do; an approved plan is the only permission.",
  },
  {
    q: "How does a money plan work?",
    a: "You write the plan, review the structured actions, then approve. Settlement checks Keep, payees, and caps before anything moves.",
  },
  {
    q: "Can a later instruction change my approved plan?",
    a: "No. After approval, later messages cannot raise Keep or add payees. Edit before you approve.",
  },
  {
    q: "Does POCKET support crypto tokens?",
    a: "Yes under the hood on Monad testnet (AUSD and related rails). The surface stays consumer-plain.",
  },
  {
    q: "What happens when an action is blocked?",
    a: "You see a clear block screen with the Keep rule that stopped it — fail closed, never a silent overspend.",
  },
  {
    q: "What happens if a movement fails?",
    a: "Nothing settles outside the plan. Failed or blocked legs show up as readable receipts.",
  },
  {
    q: "Can I review previous activity?",
    a: "Yes. Settlements and blocks appear in Wallet history from Envio + POCKET receipts.",
  },
  {
    q: "Are network fees included?",
    a: "On Monad testnet, gas sponsorship keeps fees out of the consumer flow when available.",
  },
];

function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="bb-land">
      <header className="bb-land-nav">
        <div className="bb-land-nav-inner">
          <BrandLogo />
          <nav aria-label="Marketing">
            <a href="#home">Home</a>
            <a href="#how">How it works</a>
            <Link to="/product">Features</Link>
            <a href="#control">Control</a>
            <a href="#faq">Faq</a>
          </nav>
          <Link to="/app" className="bb-land-cta">
            Get started
          </Link>
        </div>
      </header>

      <section className="bb-land-hero" id="home">
        <div className="bb-land-hero-copy">
          <p className="bb-land-kicker">
            <i aria-hidden />
            Your money. Your rules.
          </p>
          <h1>Smart way to manage your money</h1>
          <p>
            Create a money plan, review every movement, and approve it before POCKET acts. Your approved plan sets the
            limits.
          </p>
          <div className="bb-land-actions">
            <Link to="/app" className="pk-btn-primary">
              Get started
            </Link>
            <a href="#how" className="bb-btn-ghost">
              How it works
            </a>
          </div>
          <p className="bb-land-trust">
            <img src="/brand/landing/shield.svg" alt="" width={20} height={20} />
            Review first. Approve before anything moves.
          </p>
        </div>
        <div className="bb-land-phone" aria-hidden>
          <img src="/brand/landing/phone-hero.png" alt="" width={336} height={684} />
        </div>
      </section>

      <div className="bb-land-strip" aria-hidden />

      <section className="bb-land-section bb-land-center" id="problem">
        <p className="bb-land-kicker">
          <i aria-hidden />
          The problem
        </p>
        <h2>Money moves. Your instructions should still matter.</h2>
        <p className="bb-land-lead">
          Payments, balances, and crypto-token movements can quickly become difficult to keep track of.
        </p>
        <div className="bb-land-cards">
          {PROBLEMS.map((item) => (
            <article key={item.title} className="bb-land-card">
              <span className="bb-land-ico">
                <img src={item.icon} alt="" width={24} height={24} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bb-land-section bb-land-how" id="how">
        <div className="bb-land-center">
          <p className="bb-land-kicker">
            <i aria-hidden />
            How it works
          </p>
          <h2>One plan. Three clear steps.</h2>
          <p className="bb-land-lead">
            From your own words to a plan you understand, POCKET keeps approval at the center.
          </p>
        </div>
        <div className="bb-land-steps3">
          {STEPS.map((s) => (
            <article key={s.n} className="bb-land-step3">
              <div className="bb-land-step3-copy">
                <span className="bb-land-num">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
              <div className="bb-land-step3-phone">
                <img src={s.phone} alt="" width={314} height={420} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bb-land-section bb-land-center" id="features">
        <p className="bb-land-kicker">
          <i aria-hidden />
          Built around your plan
        </p>
        <h2>Everything starts with a plan you approve.</h2>
        <p className="bb-land-lead">
          POCKET connects your instructions to structured actions, so you can understand what is intended.
        </p>
        <div className="bb-land-cards">
          {FEATURES.map((item) => (
            <article key={item.title} className="bb-land-card">
              <span className="bb-land-ico">
                <img src={item.icon} alt="" width={24} height={24} />
              </span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bb-land-control" id="control">
        <div className="bb-land-control-copy">
          <p className="bb-land-kicker is-light">
            <i aria-hidden />
            Control that stays clear
          </p>
          <h2>An approved plan has boundaries.</h2>
          <p>
            Once you approve a plan, later instructions cannot raise its limit or add a payee outside the permission you
            gave.
          </p>
          <ul className="bb-land-checks">
            {CONTROL_POINTS.map((line) => (
              <li key={line}>
                <span>
                  <img src="/brand/landing/tick-light.svg" alt="" width={20} height={20} />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>
        <div className="bb-land-control-phone" aria-hidden>
          <img src="/brand/landing/phone-control.png" alt="" width={360} height={720} />
        </div>
      </section>

      <section className="bb-land-section bb-land-center" id="faq">
        <p className="bb-land-kicker">
          <i aria-hidden />
          A little more clarity
        </p>
        <h2>Questions, answered.</h2>
        <p className="bb-land-lead">Here is what to know before getting started with POCKET.</p>
        <div className="bb-land-faq">
          {FAQS.map((item, i) => {
            const open = openFaq === i;
            return (
              <button
                key={item.q}
                type="button"
                className={`bb-land-faq-item ${open ? "is-open" : ""}`}
                aria-expanded={open}
                onClick={() => setOpenFaq(open ? null : i)}
              >
                <span className="bb-land-faq-q">
                  {item.q}
                  <img src="/brand/landing/plus.svg" alt="" width={20} height={20} />
                </span>
                {open && <span className="bb-land-faq-a">{item.a}</span>}
              </button>
            );
          })}
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
          <a href="#how" className="bb-btn-ghost">
            How it works
          </a>
        </div>
      </section>

      <footer className="bb-land-footer">
        <div className="bb-land-footer-top">
          <div className="bb-land-footer-brand">
            <BrandLogo />
            <p>Money plans with clear boundaries.</p>
          </div>
          <div className="bb-land-footer-cols">
            <div>
              <strong>Product</strong>
              <a href="#how">How it works</a>
              <Link to="/product">Features</Link>
              <a href="#faq">Faq</a>
              <Link to="/about">About</Link>
            </div>
            <div>
              <strong>Socials</strong>
              <a href="https://instagram.com" target="_blank" rel="noreferrer">
                <img src="/brand/landing/instagram.svg" alt="" width={15} height={15} />
                Instagram
              </a>
              <a href="https://tiktok.com" target="_blank" rel="noreferrer">
                <img src="/brand/landing/tiktok.svg" alt="" width={15} height={15} />
                Tiktok
              </a>
              <a href="https://x.com" target="_blank" rel="noreferrer">
                <img src="/brand/landing/x.svg" alt="" width={15} height={15} />
                X
              </a>
            </div>
          </div>
        </div>
        <p className="bb-land-wordmark" aria-hidden>
          POCKET
        </p>
      </footer>
    </div>
  );
}
