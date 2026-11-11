import type { AiStateCode } from "../ai-states";
import type { OtariMeta } from "./headers";

export class OtariError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly meta: OtariMeta | null;
  readonly state: AiStateCode;
  constructor(status: number, code: string | null, detail: string, meta: OtariMeta | null) {
    super(detail || `Otari answered ${status}`);
    this.name = "OtariError";
    this.status = status;
    this.code = code;
    this.meta = meta;
    this.state = classifyOtariFailure(status, code, meta?.budgetScope ?? null);
  }
  get retryAfterSec(): number | null {
    return this.meta?.retryAfterSec ?? null;
  }
}

/**
 * Map an Otari refusal to what the member sees. Codes from the Otari error
 * code table; we map by code, never by detail text, as the docs advise.
 */
export function classifyOtariFailure(status: number, code: string | null, budgetScope: string | null): AiStateCode {
  if (code === "budget_exceeded") return budgetScope === "user" ? "allowance_used" : "app_paused";
  if (code === "user_blocked") return "allowance_used";
  if (code === "guardrail_violation") return "guard_blocked";
  if (code === "rate_limited" || code === "upstream_rate_limited" || status === 429) return "busy";
  if (status === 401) return "not_configured";
  if (
    code === "provider_not_configured" ||
    code === "provider_credential_rejected" ||
    code === "all_candidates_rejected" ||
    code === "provider_error" ||
    code === "provider_stream_interrupted" ||
    code === "insufficient_funds" ||
    status === 424
  )
    return "models_down";
  // A block-mode guardrail whose service is unreachable fails closed with 502.
  if (status === 502 || status === 503) return "guard_offline";
  if (status >= 500) return "models_down";
  return "unknown";
}

export async function otariErrorFromResponse(res: Response, meta: OtariMeta): Promise<OtariError> {
  let code = meta.errorCode;
  let detail = "";
  try {
    const body = (await res.json()) as Record<string, unknown>;
    if (!code && typeof body["code"] === "string") code = body["code"];
    const d = body["detail"];
    if (typeof d === "string") detail = d;
    else if (typeof body["error"] === "object" && body["error"]) {
      const m = (body["error"] as Record<string, unknown>)["message"];
      if (typeof m === "string") detail = m;
    }
  } catch {
    /* body is not JSON */
  }
  return new OtariError(res.status, code, detail, meta);
}
