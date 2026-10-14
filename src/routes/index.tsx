import { createFileRoute, Link } from "@tanstack/react-router";
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

function Home() {
  return (
    <div className="bb-land">
      <header className="bb-land-nav">
        <BrandLogo />
        <nav aria-label="Marketing">
          <a href="#how">How it works</a>
          <a href="#control">Control</a>
          <a href="#faq">Faq</a>
          <Link to="/product">Features</Link>
        </nav>
        <Link to="/app" className="bb-land-cta">
          Get started
        </Link>
      </header>

      <section className="bb-land-hero">
        <div className="bb-land-hero-copy">
          <p className="bb-land-kicker">Your money. Your rules.</p>
          <h1>Smart way to manage your money</h1>
          <p>
            Create a money plan, review every movement, and approve it before POCKET acts. Your approved plan sets the
            limits.
          </p>
          <div className="bb-land-actions">
            <Link to="/app" className="pk-btn-primary">
              Start a plan
            </Link>
            <a href="#how" className="bb-btn-ghost">
              How it works
            </a>
          </div>
        </div>
        <div className="bb-land-art" aria-hidden>
          <img src="/brand/hero-coins.png" alt="" width={420} height={256} />
        </div>
      </section>

      <section className="bb-land-section" id="how">
        <p className="bb-land-kicker">How it works</p>
        <h2>One plan. Three clear steps.</h2>
        <p>From your own words to a plan you understand, POCKET keeps approval at the center.</p>
        <div className="bb-land-steps">
          <article className="bb-land-step">
            <b>01</b>
            <h3>Start with what you want to do.</h3>
            <p>Write your intended payments, the amount you want to keep, and what should happen with the rest.</p>
          </article>
          <article className="bb-land-step">
            <b>02</b>
            <h3>See the plan before anything moves.</h3>
            <p>POCKET turns your instructions into clear actions, amounts, and conditions. Review the details always.</p>
          </article>
          <article className="bb-land-step">
            <b>03</b>
            <h3>Know what happens next.</h3>
            <p>Follow the status of your plan. Understand why an action may be blocked.</p>
          </article>
        </div>
      </section>

      <section className="bb-land-section" id="control">
        <p className="bb-land-kicker">Control that stays clear</p>
        <h2>An approved plan has boundaries.</h2>
        <p>
          Once you approve a plan, later instructions cannot raise its limit or add a payee outside the permission you
          gave. Overspend is not a warning — it is a stop.
        </p>
        <div className="bb-land-band">
          <h2>Review first. Approve before anything moves.</h2>
          <Link to="/app">Open POCKET</Link>
        </div>
      </section>

      <section className="bb-land-section" id="faq">
        <p className="bb-land-kicker">Faq</p>
        <h2>Built for everyday money decisions.</h2>
        <div className="bb-land-steps">
          <article className="bb-land-step">
            <h3>Is this crypto?</h3>
            <p>POCKET is a plain-English money assistant. Settlement runs under the hood on Monad testnet.</p>
          </article>
          <article className="bb-land-step">
            <h3>What does Keep mean?</h3>
            <p>Keep is your reserve floor. “Send the rest” cannot spend past it — the plan fails closed.</p>
          </article>
          <article className="bb-land-step">
            <h3>Can I change a plan later?</h3>
            <p>Edit before you approve. After approval, new messages cannot widen permissions.</p>
          </article>
        </div>
      </section>

      <footer className="bb-land-foot">
        <BrandLogo compact />
        <span>Monad testnet · Demo · Approved plan is the only permission</span>
      </footer>
    </div>
  );
}
