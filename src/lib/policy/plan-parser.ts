import { MoneyPlanSchema, SpendIntentSchema, type MoneyPlan, type SpendIntent } from "./types";

const SEND_REST =
  /\b(send|transfer|move|spend)\b[\s\w]{0,40}\b(the\s+rest|everything|all\s+(of\s+)?(it|my\s+money)|remaining)\b/i;
const KEEP_BUFFER = /keep\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i;
const AMOUNT = /\$\s*([\d,]+(?:\.\d{1,2})?)/g;
const PAY_RENT = /\b(pay|send)\b[\s\w]{0,20}\brent\b/i;

function dollarsToCents(raw: string): number {
  const n = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Parse natural-language spend attempt into a structured intent. */
export function parseSpendIntent(rawText: string, source: SpendIntent["source"] = "typed"): SpendIntent {
  const text = rawText.trim();
  let kind: SpendIntent["kind"] = "unknown";
  if (SEND_REST.test(text)) kind = "send_rest";
  else if (PAY_RENT.test(text)) kind = "pay";
  else if (/\b(buy|swap|put\s+the\s+rest\s+to\s+work)\b/i.test(text)) kind = "buy";
  else if (/\b(pay|send|transfer)\b/i.test(text)) kind = "pay";

  const amounts = [...text.matchAll(AMOUNT)].map((m) => dollarsToCents(m[1]!));
  const amountCents = amounts[0];

  return SpendIntentSchema.parse({
    source,
    rawText: text,
    amountCents,
    kind,
    payeeLabel: PAY_RENT.test(text) ? "Rent" : undefined,
  });
}

/** Build a default fail-closed plan from chat goal text (Keep $200 beachhead). */
export function parseMoneyPlanFromGoal(goalText: string, opts?: { reserveFloorCents?: number }): MoneyPlan {
  const keep = goalText.match(KEEP_BUFFER);
  const reserveFloorCents = opts?.reserveFloorCents ?? (keep ? dollarsToCents(keep[1]!) : 20_000);
  const amounts = [...goalText.matchAll(AMOUNT)].map((m) => dollarsToCents(m[1]!));
  const rentAmount = PAY_RENT.test(goalText) ? amounts.find((a) => a !== reserveFloorCents) ?? amounts[0] : amounts[0];

  const steps = [];
  if (rentAmount && PAY_RENT.test(goalText)) {
    steps.push({
      id: "pay-rent",
      action: "pay" as const,
      label: "Pay rent",
      amountCents: rentAmount,
      payee: { label: "Rent" },
      when: "this cycle",
    });
  }
  steps.push({
    id: "hold-reserve",
    action: "hold" as const,
    label: `Keep $${(reserveFloorCents / 100).toFixed(0)}`,
    amountCents: reserveFloorCents,
    when: "always",
  });

  return MoneyPlanSchema.parse({
    title: goalText.slice(0, 80) || "Money plan",
    currency: "USD",
    reserveFloorCents,
    allowlist: [{ label: "Rent" }],
    steps,
  });
}

export function assertMoneyPlan(input: unknown): MoneyPlan {
  return MoneyPlanSchema.parse(input);
}
