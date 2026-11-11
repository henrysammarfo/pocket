/**
 * Member-facing AI states. Shared by server (error mapping) and client
 * (rendering). Plain words; money is never affected by an AI failure,
 * because the policy engine and the approved plan decide, not the model.
 */
export type AiStateCode =
  | "allowance_used"
  | "app_paused"
  | "guard_blocked"
  | "guard_offline"
  | "busy"
  | "models_down"
  | "not_configured"
  | "unknown";

export type AiStatePayload = {
  pocketAi: true;
  code: AiStateCode;
  retryAfterSec: number | null;
};

export const AI_STATE_COPY: Record<AiStateCode, { title: string; body: string; tone: "info" | "warn" | "danger" }> = {
  allowance_used: {
    title: "Today's AI allowance is used up",
    body: "Your plans, your Keep and your money still work. Typing a payment still runs through your plan rules.",
    tone: "info",
  },
  app_paused: {
    title: "Pocket's AI is paused for everyone",
    body: "Pocket hit its own spending ceiling, so it stopped asking for more. Your money and plans still work.",
    tone: "warn",
  },
  guard_blocked: {
    title: "That message was stopped before it reached the AI",
    body: "It looked like an attempt to change Pocket's rules. Nothing moved. Rephrase what you want your money to do.",
    tone: "danger",
  },
  guard_offline: {
    title: "The safety check is offline",
    body: "Pocket will not send anything to the AI without it. Nothing moved.",
    tone: "warn",
  },
  busy: {
    title: "Pocket is busy",
    body: "Too many requests at once.",
    tone: "info",
  },
  models_down: {
    title: "Every AI model is unavailable right now",
    body: "Pocket tried each one in turn. Nothing moved.",
    tone: "warn",
  },
  not_configured: {
    title: "AI is not set up on this build",
    body: "Plans and payments still work through Pocket's own rules.",
    tone: "info",
  },
  unknown: {
    title: "Something went wrong",
    body: "Nothing moved.",
    tone: "warn",
  },
};

export function encodeAiState(code: AiStateCode, retryAfterSec: number | null = null): string {
  const payload: AiStatePayload = { pocketAi: true, code, retryAfterSec };
  return JSON.stringify(payload);
}

/** Parse an error string from the chat stream. Returns null when it is not ours. */
export function decodeAiState(message: string | null | undefined): AiStatePayload | null {
  if (!message) return null;
  try {
    const v: unknown = JSON.parse(message);
    if (typeof v !== "object" || v === null) return null;
    const o = v as Record<string, unknown>;
    if (o["pocketAi"] !== true || typeof o["code"] !== "string" || !(o["code"] in AI_STATE_COPY)) return null;
    return {
      pocketAi: true,
      code: o["code"] as AiStateCode,
      retryAfterSec: typeof o["retryAfterSec"] === "number" ? o["retryAfterSec"] : null,
    };
  } catch {
    return null;
  }
}

/** "in 3 h 20 min", "in 45 s". */
export function formatWait(sec: number | null): string | null {
  if (sec == null || sec <= 0) return null;
  if (sec < 60) return `in ${sec} s`;
  const m = Math.round(sec / 60);
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `in ${h} h ${rem} min` : `in ${h} h`;
}

/** Also unwraps a JSON error body ({"error": "<state>"}) as the chat transport reports it. */
export function decodeAiStateLoose(message: string | null | undefined): AiStatePayload | null {
  const direct = decodeAiState(message);
  if (direct || !message) return direct;
  try {
    const v = JSON.parse(message) as { error?: unknown };
    return typeof v?.error === "string" ? decodeAiState(v.error) : null;
  } catch {
    return null;
  }
}
