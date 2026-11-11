import { CircleAlert, Info, RotateCcw, ShieldAlert, X } from "lucide-react";
import { AI_STATE_COPY, formatWait, type AiStatePayload } from "@/lib/ai/ai-states";

/** Inline notice for every AI state a chat can end in. Money never depends on it. */
export function AiNotice({ state, onRetry, onDismiss }: { state: AiStatePayload; onRetry?: () => void; onDismiss?: () => void }) {
  const copy = AI_STATE_COPY[state.code];
  const wait = formatWait(state.retryAfterSec);
  const Icon = copy.tone === "danger" ? ShieldAlert : copy.tone === "warn" ? CircleAlert : Info;
  const canRetry = state.code !== "allowance_used" && state.code !== "app_paused" && state.code !== "not_configured" && state.code !== "guard_blocked";
  return (
    <div className={`pk-notice is-${copy.tone}`} role={copy.tone === "danger" ? "alert" : "status"}>
      <Icon size={18} aria-hidden className="pk-notice-icon" />
      <div className="pk-notice-text">
        <strong>{copy.title}</strong>
        <span>
          {copy.body}
          {state.code === "allowance_used" ? (wait ? ` It refills ${wait}.` : "") : canRetry ? (wait ? ` Try again ${wait}.` : " Try again in a moment.") : ""}
        </span>
        {canRetry && onRetry && (
          <button type="button" onClick={onRetry} className="pk-notice-btn">
            <RotateCcw size={14} aria-hidden />
            Try again
          </button>
        )}
      </div>
      <div className="pk-notice-actions">
        {onDismiss && (
          <button type="button" onClick={onDismiss} className="pk-notice-x" aria-label="Dismiss">
            <X size={14} aria-hidden />
          </button>
        )}
      </div>
    </div>
  );
}
