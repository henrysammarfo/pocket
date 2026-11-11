import { createFileRoute } from "@tanstack/react-router";
import { AiReceiptStrip, LiveToolChips } from "@/components/pocket-ui/AiReceiptStrip";
import { DrillCard } from "@/components/pocket-ui/DrillCard";
import { AiNotice } from "@/components/pocket-ui/AiNotice";
import { AllowanceCard } from "@/components/pocket-ui/AllowanceCard";
import { AiActivityList } from "@/components/pocket-ui/AiActivityList";
import { PlanCard } from "@/components/pocket-ui/PlanCard";
import { AI_STATE_COPY, type AiStateCode } from "@/lib/ai/ai-states";
import type { AiReceipt } from "@/lib/ai/otari/receipt";

/**
 * Every AI state Pocket can show, with sample data, for design review and
 * screenshots. Only served in development or when VITE_POCKET_STATES=on.
 */
export const Route = createFileRoute("/states/otari")({
  head: () => ({ meta: [{ title: "Pocket AI states" }, { name: "robots", content: "noindex" }] }),
  component: StatesPage,
});

const base: AiReceipt = {
  role: "explain",
  policy: "pocket-explain",
  model: "openai/gpt-oss-120b",
  provider: "groq",
  attempts: 1,
  fallback: false,
  durationMs: 812,
  costUsd: 0.000412,
  requestId: "req_7f3c2a9e",
  guard: "passed",
  tools: [],
  projection: null,
  ratesSource: null,
  lighter: false,
  output: [],
};

const RECEIPTS: { label: string; r: AiReceipt }[] = [
  { label: "Plain answer, first model", r: base },
  { label: "Backup model answered", r: { ...base, model: "Qwen/Qwen3-32B", provider: "together", attempts: 2, fallback: true } },
  {
    label: "Wallet, ECB rates and a checked projection",
    r: {
      ...base,
      tools: [
        { kind: "mcp", label: "Checked your balance", ok: true },
        { kind: "fetch", label: "Read www.ecb.europa.eu", ok: true },
        { kind: "code", label: "Ran the numbers in a sandbox", ok: true },
      ],
      projection: "match",
      ratesSource: "ecb",
    },
  },
  { label: "Projection disagreed", r: { ...base, tools: [{ kind: "code", label: "Ran the numbers in a sandbox", ok: true }], projection: "mismatch" } },
  { label: "Lighter model (member past 80% of allowance)", r: { ...base, lighter: true } },
  { label: "Answer talked as if money moved", r: { ...base, output: ["claims_money_moved"] } },
  { label: "A tool failed, no guard header", r: { ...base, guard: "not_run", tools: [{ kind: "fetch", label: "Read www.ecb.europa.eu", ok: false }] } },
];

function StatesPage() {
  if (!import.meta.env.DEV && import.meta.env["VITE_POCKET_STATES"] !== "on") {
    return <main className="pk-states"><p>Not available.</p></main>;
  }
  return (
    <main className="pk-states">
      <header>
        <p className="pk-hero-kicker"><i aria-hidden />Pocket on Otari</p>
        <h1>Every AI state</h1>
        <p>Sample data. The chat and settings screens render these same components.</p>
      </header>

      <section className="pk-states-chat">
        <h2>In a conversation (example)</h2>
        <div className="pk-thread-body pk-states-thread">
          <div className="pk-user">Send Ama 40 dollars for lunch on Friday</div>
          <div className="pk-chip-row" aria-label="How Pocket read your last payment message">
            <span className="pk-chip">Read by gpt-oss-20b. Your plan made the decision.</span>
          </div>
          <PlanCard steps={[{ when: "Friday", label: "Send Ama", amountLabel: "$40.00" }]} onApprove={() => undefined} onEdit={() => undefined} />
          <div className="pk-user">How much is that in euros?</div>
          <div className="pk-assistant">
            <p>About 34.50 euros at the European Central Bank reference rate. Your plan still sends dollars.</p>
            <AiReceiptStrip receipt={{ ...base, tools: [{ kind: "fetch", label: "Read www.ecb.europa.eu", ok: true }], ratesSource: "ecb" }} />
          </div>
        </div>
      </section>

      <section>
        <h2>Answer receipts</h2>
        {RECEIPTS.map(({ label, r }) => (
          <div key={label} className="pk-states-item">
            <p className="pk-states-label">{label}</p>
            <div className="pk-assistant pk-states-msg">
              <p>Save $900 a month and you reach $3,000 in 4 months.</p>
              <AiReceiptStrip receipt={r} />
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2>Receipt unfolded</h2>
        <div className="pk-states-item">
          <p className="pk-states-label">Details open: every figure comes from Otari's response headers</p>
          <div className="pk-assistant pk-states-msg">
            <p>Save $900 a month and you reach $3,000 in 4 months.</p>
            <AiReceiptStrip receipt={{ ...base, model: "Qwen/Qwen3-32B", provider: "together", attempts: 2, fallback: true }} defaultOpen />
          </div>
        </div>
        <div className="pk-states-item">
          <p className="pk-states-label">Currency answer with its source (example rate, the live one comes from the ECB file)</p>
          <div className="pk-assistant pk-states-msg">
            <p>40 US dollars is about 34.50 euros at the European Central Bank reference rate.</p>
            <AiReceiptStrip receipt={{ ...base, tools: [{ kind: "fetch", label: "Read www.ecb.europa.eu", ok: true }], ratesSource: "ecb" }} defaultOpen />
          </div>
        </div>
      </section>

      <section>
        <h2>While Otari runs tools</h2>
        <LiveToolChips
          chips={[
            { kind: "mcp", label: "Checked your balance", ok: true },
            { kind: "fetch", label: "Read www.ecb.europa.eu", ok: true, running: true },
            { kind: "code", label: "", ok: false, running: true },
          ]}
        />
      </section>

      <section>
        <h2>How a payment message was read</h2>
        <div className="pk-chip-row">
          <span className="pk-chip">Read by gpt-oss-20b. Your plan made the decision.</span>
          <span className="pk-chip">Read by Pocket's own rules. Your plan made the decision.</span>
        </div>
      </section>

      <section>
        <h2>Chat notices</h2>
        {(Object.keys(AI_STATE_COPY) as AiStateCode[]).map((code) => (
          <AiNotice
            key={code}
            state={{ pocketAi: true, code, retryAfterSec: code === "allowance_used" ? 12_000 : code === "busy" ? 30 : null }}
            onRetry={() => undefined}
            onDismiss={() => undefined}
          />
        ))}
      </section>

      <section className="bb-settings">
        <h2>Settings: AI allowance</h2>
        <AllowanceCard allowance={null} configured loading />
        <AllowanceCard allowance={{ state: "new", spentUsd: 0, limitUsd: null, period: null, usedFraction: 0 }} configured />
        <AllowanceCard allowance={{ state: "ok", spentUsd: 0.012, limitUsd: 0.05, period: "1d", usedFraction: 0.24 }} configured />
        <AllowanceCard allowance={{ state: "low", spentUsd: 0.042, limitUsd: 0.05, period: "1d", usedFraction: 0.84 }} configured />
        <AllowanceCard allowance={{ state: "used", spentUsd: 0.05, limitUsd: 0.05, period: "1d", usedFraction: 1 }} configured />
        <AllowanceCard allowance={{ state: "blocked", spentUsd: null, limitUsd: null, period: null, usedFraction: null }} configured />
        <AllowanceCard allowance={{ state: "unknown", spentUsd: null, limitUsd: null, period: null, usedFraction: null }} configured />
        <AllowanceCard allowance={null} configured={false} />
        <AllowanceCard allowance={null} configured error />
      </section>

      <section className="bb-settings">
        <h2>Settings: fallback test</h2>
        <DrillCard run={async () => ({ ok: true, reply: "ready", receipt: { ...base, role: "intent", policy: "pocket-intent-drill", model: "openai/gpt-oss-20b", attempts: 2, fallback: true } })} />
        <DrillCard run={async () => ({ ok: false, state: "allowance_used", receipt: null })} />
      </section>

      <section className="bb-settings">
        <h2>Settings: recent AI answers</h2>
        <AiActivityList rows={[]} />
        <AiActivityList
          rows={[
            { role: "explain", policy: "pocket-explain", outcome: "ok", receipt: { model: "openai/gpt-oss-120b", fallback: false }, createdAt: "2026-11-11T10:42:00Z" },
            { role: "intent", policy: "pocket-intent", outcome: "ok", receipt: { model: "openai/gpt-oss-20b", fallback: false }, createdAt: "2026-11-11T10:41:00Z" },
            { role: "explain", policy: "pocket-explain", outcome: "ok", receipt: { model: "Qwen/Qwen3-32B", fallback: true }, createdAt: "2026-11-11T10:30:00Z" },
            { role: "explain", policy: "pocket-explain", outcome: "guard_blocked", receipt: {}, createdAt: "2026-11-11T10:20:00Z" },
            { role: "intent", policy: "pocket-intent", outcome: "model_error", receipt: {}, createdAt: "2026-11-11T10:10:00Z" },
          ]}
        />
      </section>
    </main>
  );
}
