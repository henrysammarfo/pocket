import type { OtariMeta } from "./headers";
import { crossCheckProjection, type CrossCheck } from "./projection";
import { isEcbFetch } from "./ecb";
import { toolChip, type OtariToolCall, type ToolChip } from "./tool-calls";
import type { OutputCheck } from "./output-check";

/**
 * The AI receipt: what served one answer, shown under it. Built only from
 * what Otari reported (headers and otari_tool_calls), never from the model's
 * own account. Member-safe: no keys, no raw prompts.
 */
export type AiReceipt = {
  role: "explain" | "intent";
  policy: string;
  model: string | null;
  provider: string | null;
  attempts: number | null;
  fallback: boolean;
  durationMs: number | null;
  costUsd: number | null;
  requestId: string | null;
  guard: "passed" | "flagged" | "not_run";
  tools: ToolChip[];
  projection: CrossCheck["status"] | null;
  ratesSource: "ecb" | null;
  /** True when pocket-explain stepped down to its lighter model (member near budget). */
  lighter: boolean;
  output: OutputCheck["reasons"];
};

export function buildReceipt(
  role: AiReceipt["role"],
  policy: string,
  meta: OtariMeta | null,
  calls: OtariToolCall[],
  extra: { lightModel?: string; output?: OutputCheck } = {},
): AiReceipt {
  const ended = calls.filter((c) => c.status !== "in_progress");
  const checks = ended.filter((c) => c.type === "code_execution").map((c) => crossCheckProjection(c.code, c.stdout));
  // Several code runs (one per scenario): any mismatch wins, else any match.
  const proj = checks.find((c) => c.status === "mismatch") ?? checks.find((c) => c.status === "match");
  const g = meta?.guardrails ?? [];
  return {
    role,
    policy,
    model: meta?.model ?? null,
    provider: meta?.provider ?? null,
    attempts: meta?.attempts ?? null,
    fallback: meta?.fallback ?? false,
    durationMs: meta?.durationMs ?? null,
    costUsd: meta?.costUsd ?? null,
    requestId: meta?.requestId ?? null,
    guard: g.length === 0 ? "not_run" : g.some((x) => x.valid === false) ? "flagged" : "passed",
    tools: ended.map(toolChip),
    projection: proj ? proj.status : null,
    lighter: Boolean(extra.lightModel && meta?.model && !meta.fallback && meta.model.split("/").pop() === extra.lightModel.split("/").pop()),
    output: extra.output?.reasons ?? [],
    ratesSource: ended.some((c) => c.type === "web_fetch" && c.status === "completed" && isEcbFetch(c.url)) ? "ecb" : null,
  };
}
