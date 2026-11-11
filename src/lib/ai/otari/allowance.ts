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

export function readAllowance(endUser: unknown, budgets: unknown): Allowance {
  const list = Array.isArray(endUser) ? endUser : endUser ? [endUser] : [];
  const eu = list[0] as Record<string, unknown> | undefined;
  if (!eu) return { state: "new", spentUsd: 0, limitUsd: null, period: null, usedFraction: 0 };
  if (eu["blocked"] === true) return { state: "blocked", spentUsd: null, limitUsd: null, period: null, usedFraction: null };

  const nested = (typeof eu["budget"] === "object" && eu["budget"]) ? (eu["budget"] as Record<string, unknown>) : {};
  const spent = pickNum(eu, ["spend", "spent", "current_spend", "spend_usd", "period_spend"]) ?? pickNum(nested, ["spend", "current_spend"]);
  const budgetId = pickStr(eu, ["budget_id"]) ?? pickStr(nested, ["id"]);
  let limit = pickNum(nested, ["max_budget", "limit", "limit_usd", "amount"]);
  let period = pickStr(nested, ["period", "budget_duration", "reset_period"]);
  if ((limit == null || period == null) && Array.isArray(budgets) && budgetId) {
    const b = (budgets as Record<string, unknown>[]).find((x) => x && x["id"] === budgetId);
    if (b) {
      limit = limit ?? pickNum(b, ["max_budget", "limit", "limit_usd", "amount"]);
      period = period ?? pickStr(b, ["period", "budget_duration", "reset_period"]);
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
