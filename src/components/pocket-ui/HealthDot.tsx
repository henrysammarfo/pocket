import { useEffect, useState } from "react";

type HealthBody = {
  ok?: boolean;
  checks?: Record<string, boolean>;
};

/** Quiet readiness for demo ops — names only, never secret values. */
export function HealthDot() {
  const [ok, setOk] = useState<boolean | null>(null);
  const [title, setTitle] = useState("Checking readiness…");

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/health");
        const body = (await res.json()) as HealthBody;
        if (!alive) return;
        setOk(Boolean(body.ok));
        const checks = body.checks ?? {};
        const missing = Object.entries(checks)
          .filter(([, v]) => !v)
          .map(([k]) => k);
        setTitle(
          body.ok
            ? missing.length
              ? `Ready · optional off: ${missing.join(", ")}`
              : "Ready · all checks green"
            : `Not ready · missing: ${missing.join(", ") || "unknown"}`,
        );
      } catch {
        if (!alive) return;
        setOk(false);
        setTitle("Health probe unreachable");
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <span
      className={`pk-health ${ok === null ? "is-pending" : ok ? "is-ok" : "is-bad"}`}
      title={title}
      aria-label={title}
    >
      <span className="pk-health-dot" aria-hidden />
      <span className="pk-health-label">{ok === null ? "…" : ok ? "Ready" : "Setup"}</span>
    </span>
  );
}
