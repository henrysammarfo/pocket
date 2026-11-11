/**
 * Read what Otari says about a response from its headers.
 * Header names and meanings: Otari docs routing.md "What is billed and what
 * the caller sees", api-reference.md "Error codes", guardrails-reference.md.
 */
export type GuardrailVerdict = {
  profile: string;
  mode: string;
  valid: boolean | null;
  score: number | null;
  status: string | null;
};

export type OtariMeta = {
  requestId: string | null;
  provider: string | null;
  model: string | null;
  attempts: number | null;
  fallback: boolean;
  durationMs: number | null;
  costUsd: number | null;
  endUserBudget: string | null;
  budgetScope: string | null;
  errorCode: string | null;
  retryAfterSec: number | null;
  guardrails: GuardrailVerdict[];
};

function int(v: string | null): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function num(v: string | null): number | null {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseGuardrails(raw: string | null): GuardrailVerdict[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
      .map((e) => ({
        profile: typeof e["profile"] === "string" ? e["profile"] : "unknown",
        mode: typeof e["mode"] === "string" ? e["mode"] : "monitor",
        valid: typeof e["valid"] === "boolean" ? e["valid"] : null,
        score: typeof e["score"] === "number" ? e["score"] : null,
        status: typeof e["status"] === "string" ? e["status"] : null,
      }));
  } catch {
    return [];
  }
}

/** Retry-After is seconds or an HTTP date. */
export function parseRetryAfter(raw: string | null, now: Date = new Date()): number | null {
  if (!raw) return null;
  const secs = int(raw);
  if (secs != null) return Math.max(0, secs);
  const when = Date.parse(raw);
  if (Number.isNaN(when)) return null;
  return Math.max(0, Math.round((when - now.getTime()) / 1000));
}

export function parseOtariHeaders(h: Headers, now: Date = new Date()): OtariMeta {
  return {
    requestId: h.get("otari-request-id"),
    provider: h.get("otari-provider"),
    model: h.get("otari-model"),
    attempts: int(h.get("otari-attempt-count")),
    fallback: (h.get("otari-fallback") ?? "").toLowerCase() === "true",
    durationMs: int(h.get("otari-response-duration-ms")),
    costUsd: num(h.get("otari-cost-usd")),
    endUserBudget: h.get("otari-end-user-budget"),
    budgetScope: h.get("otari-budget-scope"),
    errorCode: h.get("otari-error-code"),
    retryAfterSec: parseRetryAfter(h.get("retry-after"), now),
    guardrails: parseGuardrails(h.get("otari-guardrails")),
  };
}
