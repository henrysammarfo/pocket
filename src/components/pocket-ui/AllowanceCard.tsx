import type { Allowance } from "@/lib/ai/otari/allowance";

const PERIOD: Record<string, string> = { "1d": "today", "24h": "today", day: "today", daily: "today", "7d": "this week", week: "this week", weekly: "this week", "30d": "this month", "1mo": "this month", month: "this month", monthly: "this month" };
const periodWord = (p: string | null) => (p ? PERIOD[p.toLowerCase()] ?? `per ${p}` : "this period");
const usd = (n: number) => (n < 0.1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`);

/**
 * The member's own AI allowance, read live from Otari's end-user budget.
 * When it runs out, only the AI pauses; plans and payments keep working.
 */
export function AllowanceCard({ allowance, configured, loading, error, onRetry }: { allowance: Allowance | null; configured: boolean; loading?: boolean; error?: boolean; onRetry?: () => void }) {
  if (loading) {
    return (
      <div className="bb-set-card pk-allow" aria-busy="true">
        <strong>AI allowance</strong>
        <div className="pk-meter is-loading" aria-hidden><i /></div>
        <span>Checking your allowance</span>
      </div>
    );
  }
  if (error || !configured || !allowance) {
    return (
      <div className="bb-set-card pk-allow">
        <strong>AI allowance</strong>
        <span>{!configured ? "AI is not set up on this build. Plans and payments still work." : "Could not read your allowance right now. Your money is not affected."}</span>
        {configured && onRetry && (
          <button type="button" className="bb-text-link pk-linkbtn" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }
  const { state } = allowance;
  const pct = allowance.usedFraction == null ? null : Math.round(allowance.usedFraction * 100);
  const line =
    state === "new"
      ? "You have your full allowance. Pocket's AI is ready."
      : state === "blocked"
        ? "AI is turned off for your account. Plans and payments still work."
        : state === "unknown"
          ? "Your allowance is active. Pocket could not read the exact numbers."
          : `${usd(allowance.spentUsd ?? 0)} of ${usd(allowance.limitUsd ?? 0)} used ${periodWord(allowance.period)}`;
  const sub =
    state === "used"
      ? "Used up. The AI pauses until it refills; your plans, your Keep and payments keep working."
      : state === "low"
        ? "Running low. Short questions use less."
        : "Each answer uses a little. Otari, Pocket's AI gateway, keeps the count.";
  return (
    <div className={`bb-set-card pk-allow is-${state}`}>
      <div className="pk-allow-head">
        <strong>AI allowance</strong>
        {pct != null && <span className="pk-allow-pct">{pct}%</span>}
      </div>
      {pct != null && (
        <div className="pk-meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="AI allowance used">
          <i style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
      )}
      {pct != null && (
        <span className="pk-allow-scale" aria-hidden>
          <span>0%</span>
          <span>Lighter model from 80%</span>
          <span>100%</span>
        </span>
      )}
      <span>{line}</span>
      {state !== "blocked" && state !== "unknown" && state !== "new" && <span className="pk-allow-sub">{sub}</span>}
    </div>
  );
}
