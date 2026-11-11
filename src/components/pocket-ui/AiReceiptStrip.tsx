import { Calculator, ChevronDown, Feather, Globe, Route, ShieldAlert, ShieldCheck, Wallet, Wrench } from "lucide-react";
import { useId, useState } from "react";
import type { AiReceipt } from "@/lib/ai/otari/receipt";
import type { ToolChip } from "@/lib/ai/otari/tool-calls";

/** Short display name for a model id like "openai/gpt-oss-120b". */
export function shortModel(model: string | null): string {
  if (!model) return "an open model";
  return model.split("/").pop() ?? model;
}

const secs = (ms: number | null) => (ms == null ? null : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

function ToolIcon({ kind }: { kind: ToolChip["kind"] }) {
  const p = { size: 14, "aria-hidden": true } as const;
  if (kind === "fetch" || kind === "search") return <Globe {...p} />;
  if (kind === "code") return <Calculator {...p} />;
  if (kind === "mcp") return <Wallet {...p} />;
  return <Wrench {...p} />;
}

/**
 * Under every AI answer: which open model actually answered, whether Otari
 * fell back, the safety check, and each tool Otari ran. Built only from what
 * Otari reported, never from the model's own words.
 */
/** Chips shown while Otari is still running tools for an answer. */
export function LiveToolChips({ chips }: { chips: (ToolChip & { running?: boolean })[] }) {
  if (!chips.length) return null;
  return (
    <div className="pk-receipt pk-live-tools" aria-live="polite">
      <div className="pk-receipt-row">
        {chips.map((t, i) => (
          <span key={i} className={`pk-receipt-item ${t.running ? "is-running" : t.ok ? "" : "is-warn"}`}>
            <ToolIcon kind={t.kind} />
            {t.running ? runningLabel(t.kind) : t.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function runningLabel(kind: ToolChip["kind"]): string {
  if (kind === "fetch") return "Reading exchange rates";
  if (kind === "code") return "Running the numbers";
  if (kind === "mcp") return "Checking your wallet";
  if (kind === "search") return "Searching";
  return "Working";
}

export function AiReceiptStrip({ receipt, defaultOpen = false }: { receipt: AiReceipt; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const detailsId = useId();
  const time = secs(receipt.durationMs);
  return (
    <div className={`pk-receipt${receipt.fallback ? " is-backup" : ""}`} data-role={receipt.role}>
      <div className="pk-receipt-row">
        <span className="pk-receipt-item">
          <Route size={14} aria-hidden />
          {receipt.fallback ? "Served by backup model" : "Answered by"} <strong>{shortModel(receipt.model)}</strong>
          {receipt.fallback && <em className="pk-receipt-flag">attempt {receipt.attempts ?? 2}</em>}
        </span>
        {receipt.lighter && (
          <span className="pk-receipt-item">
            <Feather size={14} aria-hidden />
            Lighter model, to stretch your allowance
          </span>
        )}
        {receipt.guard === "passed" && (
          <span className="pk-receipt-item is-ok">
            <ShieldCheck size={14} aria-hidden />
            Safety check passed
          </span>
        )}
        {receipt.guard === "flagged" && (
          <span className="pk-receipt-item is-warn">
            <ShieldAlert size={14} aria-hidden />
            Safety check flagged this
          </span>
        )}
        {receipt.tools.map((t, i) => (
          <span key={i} data-kind={t.ok ? t.kind : undefined} className={`pk-receipt-item ${t.ok ? "" : "is-warn"}`}>
            <ToolIcon kind={t.kind} />
            {t.ok && t.kind === "code" ? "Computed in sandbox" : t.label}
          </span>
        ))}
        {receipt.projection === "match" && (
          <span className="pk-receipt-item is-ok">
            <ShieldCheck size={14} aria-hidden />
            Pocket rechecked the math: same answer
          </span>
        )}
        {receipt.projection === "mismatch" && (
          <span className="pk-receipt-item is-bad">
            <ShieldAlert size={14} aria-hidden />
            Pocket got a different answer. Do not rely on these numbers.
          </span>
        )}
        {receipt.output?.includes("claims_money_moved") && (
          <span className="pk-receipt-item is-bad">
            <ShieldAlert size={14} aria-hidden />
            This answer talks as if money moved. It did not: only your approved plan moves money.
          </span>
        )}
        {receipt.output?.includes("asks_for_secret") && (
          <span className="pk-receipt-item is-bad">
            <ShieldAlert size={14} aria-hidden />
            Never share a recovery phrase or private key. Pocket will never ask.
          </span>
        )}
        <button type="button" className="pk-receipt-more" aria-expanded={open} aria-controls={detailsId} onClick={() => setOpen((v) => !v)}>
          Details
          <ChevronDown size={14} aria-hidden style={{ transform: open ? "rotate(180deg)" : undefined }} />
        </button>
      </div>
      {open && (
        <dl id={detailsId} className="pk-receipt-details">
          <div><dt>Routing policy</dt><dd>{receipt.policy}</dd></div>
          <div><dt>Model</dt><dd>{receipt.model ?? "Not reported"}</dd></div>
          <div><dt>Provider</dt><dd>{receipt.provider ?? "Not reported"}</dd></div>
          <div><dt>Models tried</dt><dd>{receipt.attempts ?? "Not reported"}</dd></div>
          <div><dt>Time to answer</dt><dd>{time ?? "Not reported"}</dd></div>
          <div><dt>Cost</dt><dd>{receipt.costUsd == null ? "Not reported" : `$${receipt.costUsd.toFixed(6)}`}</dd></div>
          {receipt.ratesSource === "ecb" && <div><dt>Exchange rates</dt><dd>European Central Bank daily reference rates (ecb.europa.eu)</dd></div>}
          <div><dt>Request</dt><dd className="pk-mono">{receipt.requestId ?? "Not reported"}</dd></div>
        </dl>
      )}
    </div>
  );
}
