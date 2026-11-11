import { useState } from "react";
import { FlaskConical } from "lucide-react";
import { authHeader } from "@/hooks/useAuth";
import type { DrillResult } from "@/lib/ai/otari/drill";
import { AI_STATE_COPY, type AiStateCode } from "@/lib/ai/ai-states";
import { AiReceiptStrip } from "./AiReceiptStrip";

/**
 * A labelled test, off until the member runs it: sends one tiny request
 * through a routing policy whose first model cannot serve, to prove Otari
 * falls back to the next open model. Money is never involved.
 */
export function DrillCard({ run }: { run?: () => Promise<DrillResult | { ok: false; state: string; receipt: null }> }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DrillResult | { ok: false; state: string; receipt: null } | null>(null);
  const go = async () => {
    setBusy(true);
    try {
      if (run) setResult(await run());
      else {
        const res = await fetch("/api/ai/drill", { method: "POST", headers: await authHeader() });
        setResult((await res.json()) as DrillResult);
      }
    } catch {
      setResult({ ok: false, state: "unknown", receipt: null });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="bb-set-card pk-drill">
      <div className="pk-allow-head">
        <strong>Fallback test</strong>
        <span className="pk-tag"><FlaskConical size={12} aria-hidden />Test</span>
      </div>
      <span>Sends one tiny message to a model that is set up to fail, so you can watch Pocket switch to a backup open model. It uses a sliver of your AI allowance and never touches money.</span>
      <button type="button" className="pk-notice-btn" onClick={() => void go()} disabled={busy} aria-busy={busy}>
        {busy ? "Running the test" : result ? "Run it again" : "Run the fallback test"}
      </button>
      {result?.ok && (
        <div className="pk-drill-result" role="status">
          <span>{result.receipt.fallback ? "Backup model answered. Fallback works." : "The first model answered, so no fallback was needed this time."}</span>
          <AiReceiptStrip receipt={result.receipt} />
        </div>
      )}
      {result && !result.ok && (
        <div className="pk-drill-result" role="status">
          <span>{AI_STATE_COPY[(result.state in AI_STATE_COPY ? result.state : "unknown") as AiStateCode].title}</span>
        </div>
      )}
    </div>
  );
}
