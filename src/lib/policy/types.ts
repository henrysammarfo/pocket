import { z } from "zod";

export const PayeeSchema = z.object({
  label: z.string().min(1),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
});

export const PlanStepSchema = z.object({
  id: z.string(),
  action: z.enum(["pay", "hold", "allocate", "buy"]),
  label: z.string(),
  amountCents: z.number().int().nonnegative(),
  payee: PayeeSchema.optional(),
  when: z.string().optional(),
});

export const MoneyPlanSchema = z.object({
  title: z.string(),
  currency: z.string().default("USD"),
  reserveFloorCents: z.number().int().nonnegative(),
  spendingCapCents: z.number().int().nonnegative().optional(),
  allowlist: z.array(PayeeSchema).default([]),
  steps: z.array(PlanStepSchema).default([]),
  expiresAt: z.string().datetime().optional(),
});

export type MoneyPlan = z.infer<typeof MoneyPlanSchema>;
export type PlanStep = z.infer<typeof PlanStepSchema>;

export const SpendIntentSchema = z.object({
  source: z.enum(["typed", "spoken", "system"]).default("typed"),
  rawText: z.string().min(1),
  amountCents: z.number().int().positive().optional(),
  payeeLabel: z.string().optional(),
  payeeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  kind: z.enum(["pay", "send_rest", "buy", "unknown"]).default("unknown"),
});

export type SpendIntent = z.infer<typeof SpendIntentSchema>;

export type PolicyDecision =
  | {
      allowed: true;
      reason: string;
      intent: SpendIntent;
      matchedStepId?: string;
    }
  | {
      allowed: false;
      reason: string;
      code: "NO_PLAN" | "EXPIRED" | "RESERVE_FLOOR" | "NOT_ALLOWLISTED" | "OVER_CAP" | "SEND_REST" | "DENY_DEFAULT";
      intent: SpendIntent;
      bufferRemainingCents: number;
    };

export type ComposedLeg = {
  rail: "agora" | "kuru" | "transfer";
  amountCents: number;
  asset: "AUSD" | "CTK" | "MON";
  to?: `0x${string}`;
  memo: string;
};

export type ComposedIntent = {
  legs: ComposedLeg[];
  plainEnglish: string;
};
