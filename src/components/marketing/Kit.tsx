import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, ArrowUp, Ban, Check, CheckCircle2, CircleSlash2, LockKeyhole, Mic, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { LoaderGrid } from "@/components/pocket-ui/LoadingState";

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="mk-eyebrow"><i aria-hidden />{children}</span>;
}

export function PageHero({ eyebrow, title, copy, children, aside }: { eyebrow: string; title: ReactNode; copy: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <section className={`mk-hero ${aside ? "mk-hero--split" : ""}`}>
      <div className="mk-hero-copy">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1>{title}</h1>
        <p>{copy}</p>
        {children && <div className="mk-actions">{children}</div>}
      </div>
      {aside && <div className="mk-hero-aside">{aside}</div>}
    </section>
  );
}

export function SectionHead({ eyebrow, title, copy }: { eyebrow: string; title: ReactNode; copy?: string }) {
  return <div className="mk-head"><Eyebrow>{eyebrow}</Eyebrow><h2>{title}</h2>{copy && <p>{copy}</p>}</div>;
}

export function PrimaryLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="mk-btn mk-btn--primary">{children}<ArrowRight aria-hidden /></Link>;
}
export function GhostLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="mk-btn">{children}</Link>;
}

export type Feature = { icon: LucideIcon; kicker: string; title: string; copy: string; tone?: "danger" };
export function FeatureGrid({ items, cols = 3 }: { items: Feature[]; cols?: 2 | 3 | 4 }) {
  return (
    <div className={`mk-grid mk-grid--${cols}`}>
      {items.map(({ icon: Icon, kicker, title, copy, tone }) => (
        <article key={title} className={`mk-card ${tone === "danger" ? "mk-card--danger" : ""}`}>
          <span className="mk-icon"><Icon aria-hidden /></span>
          <span className="mk-kicker">{kicker}</span>
          <h3>{title}</h3>
          <p>{copy}</p>
        </article>
      ))}
    </div>
  );
}

export function CtaBand({ title, copy, to, label }: { title: ReactNode; copy: string; to: string; label: string }) {
  return (
    <section className="mk-cta">
      <div><h2>{title}</h2><p>{copy}</p></div>
      <PrimaryLink to={to}>{label}</PrimaryLink>
    </section>
  );
}

/* Interface mocks lifted from the kit: prompt bar, approval card, blocked card, loader */

export function PromptMock({ text = "Pay rent Friday, keep $200, put the rest to work." }: { text?: string }) {
  return (
    <div className="mk-prompt" aria-label="Example plan typed into POCKET">
      <p>{text}<span className="mk-caret" aria-hidden /></p>
      <div className="mk-prompt-bar">
        <span className="mk-chip"><Sparkles aria-hidden /> Money plan</span>
        <span className="mk-prompt-tools"><span className="mk-tool"><Mic aria-hidden /></span><span className="mk-send"><ArrowUp aria-hidden /></span></span>
      </div>
    </div>
  );
}

function useElapsed() {
  const [s, setS] = useState(0);
  useEffect(() => { const t = setInterval(() => setS((v) => (v >= 9.9 ? 0 : +(v + 0.1).toFixed(1))), 100); return () => clearInterval(t); }, []);
  return s.toFixed(1);
}

export function LoaderMock({ label = "Checking your rules" }: { label?: string }) {
  const elapsed = useElapsed();
  return (
    <div className="mk-loader" role="status">
      <LoaderGrid />
      <span className="mk-shimmer">{label}</span>
      <span className="mk-mono">{elapsed}s</span>
    </div>
  );
}

export function ApprovalMock() {
  const legs = [
    { icon: Check, label: "Pay rent", meta: "Agora · Friday", amount: "$1,200" },
    { icon: LockKeyhole, label: "Keep available", meta: "Protected floor", amount: "$200" },
    { icon: Sparkles, label: "Put to work", meta: "Kuru · under 25% cap", amount: "$440" },
  ];
  return (
    <div className="mk-approval">
      <div className="mk-approval-top"><span className="mk-status mk-status--ok"><ShieldCheck aria-hidden /> All rules pass</span><span className="mk-mono">3 legs · testnet</span></div>
      <ul>
        {legs.map(({ icon: Icon, label, meta, amount }) => (
          <li key={label}><span className="mk-leg-icon"><Icon aria-hidden /></span><span><strong>{label}</strong><small>{meta}</small></span><b className="mk-mono">{amount}</b></li>
        ))}
      </ul>
      <div className="mk-approval-actions"><span className="mk-btn mk-btn--sm">Edit</span><span className="mk-btn mk-btn--sm mk-btn--primary">Approve once</span></div>
    </div>
  );
}

export function BlockedMock() {
  return (
    <div className="mk-blocked">
      <span className="mk-status mk-status--bad"><Ban aria-hidden /> Plan blocked</span>
      <strong>$145 exceeds your $120 weekend limit.</strong>
      <small>No transaction composed. No funds moved.</small>
    </div>
  );
}

export function ReceiptMock({ rows }: { rows: { id: string; action: string; amount: string; status: string }[] }) {
  return (
    <div className="mk-receipts">
      {rows.map((r) => (
        <div key={r.id} className="mk-receipt">
          <span className={`mk-dot ${r.status === "Blocked" ? "is-bad" : ""}`}>{r.status === "Blocked" ? <CircleSlash2 aria-hidden /> : <CheckCircle2 aria-hidden />}</span>
          <span className="mk-receipt-main"><strong>{r.action}</strong><code>{r.id}</code></span>
          <span className="mk-mono">{r.amount}</span>
        </div>
      ))}
    </div>
  );
}
