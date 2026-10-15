import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/BrandLogo";

type LandChromeProps = {
  children: ReactNode;
  active?: "home" | "how" | "features" | "control" | "faq" | "about";
};

export function LandChrome({ children, active }: LandChromeProps) {
  return (
    <div className="bb-land">
      <header className="bb-land-nav">
        <div className="bb-land-nav-inner">
          <Link to="/" aria-label="Pocket home">
            <BrandLogo />
          </Link>
          <nav aria-label="Marketing">
            <Link to="/" className={active === "home" ? "is-active" : undefined}>
              Home
            </Link>
            <a href="/#how" className={active === "how" ? "is-active" : undefined}>
              How it works
            </a>
            <Link to="/product" className={active === "features" ? "is-active" : undefined}>
              Features
            </Link>
            <a href="/#control" className={active === "control" ? "is-active" : undefined}>
              Control
            </a>
            <a href="/#faq" className={active === "faq" ? "is-active" : undefined}>
              Faq
            </a>
          </nav>
          <Link to="/app" className="bb-land-cta">
            Get started
          </Link>
        </div>
      </header>
      {children}
      <footer className="bb-land-footer">
        <div className="bb-land-footer-top">
          <div className="bb-land-footer-brand">
            <BrandLogo />
            <p>Money plans with clear boundaries.</p>
          </div>
          <div className="bb-land-footer-cols">
            <div>
              <strong>Product</strong>
              <a href="/#how">How it works</a>
              <Link to="/product">Features</Link>
              <a href="/#faq">Faq</a>
              <Link to="/about">About</Link>
            </div>
            <div>
              <strong>More</strong>
              <Link to="/security">Safety</Link>
              <Link to="/activity">Activity</Link>
              <Link to="/contact">Contact</Link>
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
