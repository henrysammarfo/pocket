import { otariGet, type OtariClientOptions } from "./client";
import { endUserId } from "./config";

/**
 * The member's AI allowance, read from Otari's end-user routes with the
 * service key (end-users.md "End-user routes"). Field names on the end-user
 * object are read defensively: the docs list it as "its budget, counters and
 * blocked state" without a fixed schema, so we accept the common spellings and
 * report `unknown` rather than guess.
 */
export type Allowance = {
  state: "ok" | "low" | "used" | "blocked" | "new" | "unknown";
  spentUsd: number | null;
  limitUsd: number | null;
  period: string | null;
  /** 0..1 of the allowance used, when both numbers are known. */
  usedFraction: number | null;
};

const pickNum = (o: Record<string, unknown>, keys: string[]): number | null => {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  }
  return null;
};
const pickStr = (o: Record<string, unknown>, keys: string[]): string | null => {
  for (const k of keys) if (typeof o[k] === "string" && o[k]) return o[k] as string;
  return null;
};

/** "daily" for Otari's calendar_day alignment or a 86400 s duration; otherwise whatever it says. */
function budgetPeriod(b: Record<string, unknown>): string | null {
  const align = pickStr(b, ["reset_alignment", "period", "budget_duration", "reset_period"]);
  if (align === "calendar_day" || b["budget_duration_sec"] === 86400) return "daily";
  if (align === "calendar_week" || b["budget_duration_sec"] === 604800) return "weekly";
  if (align === "calendar_month") return "monthly";
  return align;
}

export function readAllowance(endUser: unknown, budgets: unknown): Allowance {
  const list = Array.isArray(endUser) ? endUser : endUser ? [endUser] : [];
  const eu = list[0] as Record<string, unknown> | undefined;
  const budgetList = Array.isArray(budgets) ? (budgets as Record<string, unknown>[]).filter((x) => x && typeof x === "object") : [];
  if (!eu) {
    // Otari creates the end user on the first request; until then the default budget is what applies.
    const d = budgetList.find((b) => b["is_default"] === true);
    return { state: "new", spentUsd: 0, limitUsd: d ? pickNum(d, ["max_budget", "limit", "limit_usd", "amount"]) : null, period: d ? budgetPeriod(d) : null, usedFraction: 0 };
  }
  if (eu["blocked"] === true) return { state: "blocked", spentUsd: null, limitUsd: null, period: null, usedFraction: null };

  const nested = (typeof eu["budget"] === "object" && eu["budget"]) ? (eu["budget"] as Record<string, unknown>) : {};
  const spent = pickNum(eu, ["spend", "spent", "current_spend", "spend_usd", "period_spend"]) ?? pickNum(nested, ["spend", "current_spend"]);
  const budgetId = pickStr(eu, ["budget_id"]) ?? pickStr(nested, ["id"]);
  let limit = pickNum(nested, ["max_budget", "limit", "limit_usd", "amount"]);
  let period = pickStr(nested, ["period", "budget_duration", "reset_period"]);
  if ((limit == null || period == null) && budgetId) {
    // Live Otari names the key `budget_id` on both objects.
    const b = budgetList.find((x) => x["budget_id"] === budgetId || x["id"] === budgetId);
    if (b) {
      limit = limit ?? pickNum(b, ["max_budget", "limit", "limit_usd", "amount"]);
      period = period ?? budgetPeriod(b);
    }
  }
  if (spent == null || limit == null || limit <= 0) return { state: "unknown", spentUsd: spent, limitUsd: limit, period, usedFraction: null };
  const usedFraction = Math.round(Math.min(1, Math.max(0, spent / limit)) * 1000) / 1000;
  const state = usedFraction >= 1 ? "used" : usedFraction >= 0.8 ? "low" : "ok";
  return { state, spentUsd: spent, limitUsd: limit, period, usedFraction };
}

export async function fetchAllowance(memberId: string, opts: OtariClientOptions = {}): Promise<Allowance> {
  const id = encodeURIComponent(endUserId(memberId));
  const [eu, budgets] = await Promise.all([
    otariGet(`/end-users?external_id=${id}`, opts),
    otariGet(`/end-user-budgets`, opts).catch(() => ({ body: [] as unknown })),
  ]);
  const bl = budgets.body as unknown;
  const budgetList = Array.isArray(bl) ? bl : (bl && typeof bl === "object" && Array.isArray((bl as Record<string, unknown>)["data"])) ? (bl as Record<string, unknown>)["data"] : [];
  const eub = eu.body as unknown;
  const euList = Array.isArray(eub) ? eub : (eub && typeof eub === "object" && Array.isArray((eub as Record<string, unknown>)["data"])) ? (eub as Record<string, unknown>)["data"] : [];
  return readAllowance(euList, budgetList);
}
