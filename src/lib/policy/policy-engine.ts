import type { MoneyPlan, PolicyDecision, SpendIntent } from "./types";

export type PolicyContext = {
  plan: MoneyPlan | null;
  /** Current spendable balance in cents (wallet + idle). */
  balanceCents: number;
  /** Sum of already executed in-plan pays this period. */
  spentCents?: number;
  now?: Date;
};

/**
 * Fail-closed PolicyEngine.
 * Prompt text is never permission — only the approved plan is.
 */
export function evaluatePolicy(intent: SpendIntent, ctx: PolicyContext): PolicyDecision {
  const now = ctx.now ?? new Date();
  const plan = ctx.plan;

  if (!plan) {
    return {
      allowed: false,
      code: "NO_PLAN",
      reason: "No approved money plan. Approve a plan before anything can move.",
      intent,
      bufferRemainingCents: 0,
    };
  }

  if (plan.expiresAt && new Date(plan.expiresAt) < now) {
    return {
      allowed: false,
      code: "EXPIRED",
      reason: "This plan expired. Approve a new plan to move money.",
      intent,
      bufferRemainingCents: Math.max(0, ctx.balanceCents),
    };
  }

  const buffer = plan.reserveFloorCents;
  const balanceAfter = (amount: number) => ctx.balanceCents - amount;

  // Explicit product rule: "send the rest" always fails closed against reserve.
  if (intent.kind === "send_rest") {
    return {
      allowed: false,
      code: "SEND_REST",
      reason: `Blocked. Keep $${(buffer / 100).toFixed(0)} is pinned. Nothing moved.`,
      intent,
      bufferRemainingCents: Math.max(buffer, Math.min(ctx.balanceCents, buffer)),
    };
  }

  const amount = intent.amountCents;
  if (amount == null || amount <= 0) {
    return {
      allowed: false,
      code: "DENY_DEFAULT",
      reason: "Could not determine a safe amount. Nothing moved.",
      intent,
      bufferRemainingCents: Math.min(ctx.balanceCents, buffer),
    };
  }

  if (balanceAfter(amount) < buffer) {
    return {
      allowed: false,
      code: "RESERVE_FLOOR",
      reason: `Blocked. That would dip below your Keep $${(buffer / 100).toFixed(0)}. Nothing moved.`,
      intent,
      bufferRemainingCents: Math.min(ctx.balanceCents, buffer),
    };
  }

  if (plan.spendingCapCents != null) {
    const spent = (ctx.spentCents ?? 0) + amount;
    if (spent > plan.spendingCapCents) {
      return {
        allowed: false,
        code: "OVER_CAP",
        reason: "Blocked. That exceeds your plan spending cap. Nothing moved.",
        intent,
        bufferRemainingCents: Math.min(ctx.balanceCents, buffer),
      };
    }
  }

  const payeeLabel = (intent.payeeLabel || "").toLowerCase();
  const allow = plan.allowlist.map((p) => p.label.toLowerCase());
  const matchedStep = plan.steps.find(
    (s) =>
      s.action === "pay" &&
      s.amountCents === amount &&
      (!payeeLabel || s.payee?.label.toLowerCase() === payeeLabel),
  );

  if (intent.kind === "pay" || intent.kind === "buy") {
    const allowlisted =
      matchedStep ||
      (payeeLabel && allow.includes(payeeLabel)) ||
      (intent.payeeAddress && plan.allowlist.some((p) => p.address?.toLowerCase() === intent.payeeAddress?.toLowerCase()));

    if (!allowlisted) {
      return {
        allowed: false,
        code: "NOT_ALLOWLISTED",
        reason: "Blocked. That payee is not on your approved plan. Nothing moved.",
        intent,
        bufferRemainingCents: Math.min(ctx.balanceCents, buffer),
      };
    }
  } else {
    return {
      allowed: false,
      code: "DENY_DEFAULT",
      reason: "Blocked. The plan does not authorize this. Nothing moved.",
      intent,
      bufferRemainingCents: Math.min(ctx.balanceCents, buffer),
    };
  }

  return {
    allowed: true,
    reason: matchedStep ? `Allowed by plan step: ${matchedStep.label}` : "Allowed by approved plan.",
    intent,
    ...(matchedStep?.id ? { matchedStepId: matchedStep.id } : {}),
  };
}
