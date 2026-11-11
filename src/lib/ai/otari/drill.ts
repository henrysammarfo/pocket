import { otariChat, type OtariClientOptions } from "./client";
import { readOtariConfig } from "./config";
import { encodeAiState } from "../ai-states";
import { OtariError } from "./errors";
import { buildReceipt, type AiReceipt } from "./receipt";

/**
 * Resilience drill. Sends one tiny request to the routing policy
 * `pocket-intent-drill`, whose first candidate is deliberately a model that
 * cannot serve, so Otari's fallback is exercised for real and repeatably.
 * Labelled as a test in Settings and off unless the member runs it.
 */
export type DrillResult = { ok: true; receipt: AiReceipt; reply: string } | { ok: false; state: string; receipt: AiReceipt | null };

export async function runDrill(memberId: string, opts: OtariClientOptions = {}): Promise<DrillResult> {
  const config = opts.config ?? readOtariConfig();
  try {
    const res = await otariChat(
      {
        model: config.drillModel,
        memberId,
        temperature: 0,
        max_tokens: 12,
        tags: ["pocket:drill"],
        messages: [{ role: "user", content: "Reply with the single word: ready" }],
      },
      { ...opts, config },
    );
    return { ok: true, receipt: buildReceipt("intent", config.drillModel, res.meta, []), reply: res.text.trim().slice(0, 40) };
  } catch (e) {
    if (e instanceof OtariError) return { ok: false, state: JSON.parse(encodeAiState(e.state, e.retryAfterSec)).code, receipt: e.meta ? buildReceipt("intent", config.drillModel, e.meta, []) : null };
    return { ok: false, state: "unknown", receipt: null };
  }
}
