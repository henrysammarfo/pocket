import type { AiReceipt } from "@/lib/ai/otari/receipt";
import { AI_STATE_COPY, type AiStateCode } from "@/lib/ai/ai-states";
import { shortModel } from "./AiReceiptStrip";

export type AiActivityRow = { role: string; policy: string; outcome: string; receipt: Partial<AiReceipt>; createdAt: string };

const ROLE: Record<string, string> = { explain: "Plan answer", intent: "Read your message" };

function when(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Recent AI calls, newest first, from Pocket's own audit of Otari's reports. */
export function AiActivityList({ rows, loading }: { rows: AiActivityRow[]; loading?: boolean }) {
  if (loading) return <div className="bb-set-card"><span>Loading recent AI answers</span></div>;
  if (!rows.length) {
    return (
      <div className="bb-set-card">
        <strong>No AI answers yet</strong>
        <span>Ask Pocket for a plan and each answer will show which open model replied.</span>
      </div>
    );
  }
  return (
    <ul className="pk-ai-list" aria-label="Recent AI answers">
      {rows.map((r, i) => {
        const failed = r.outcome !== "ok" && r.outcome in AI_STATE_COPY;
        const rules = r.role === "intent" && r.outcome !== "ok" && !failed;
        return (
          <li key={i} className="pk-ai-row">
            <div>
              <strong>{ROLE[r.role] ?? r.role}</strong>
              <span>
                {failed
                  ? AI_STATE_COPY[r.outcome as AiStateCode].title
                  : rules
                    ? "Pocket's own rules read it"
                    : `${shortModel(r.receipt.model ?? null)}${r.receipt.fallback ? ", backup model" : ""}`}
              </span>
            </div>
            <time dateTime={r.createdAt}>{when(r.createdAt)}</time>
          </li>
        );
      })}
    </ul>
  );
}
