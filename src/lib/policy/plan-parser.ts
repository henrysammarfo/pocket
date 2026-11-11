import { MoneyPlanSchema, SpendIntentSchema, type MoneyPlan, type SpendIntent } from "./types";

const SEND_REST =
  /\b(send|transfer|move|spend)\b[\s\w]{0,40}\b(the\s+rest|everything|all\s+(of\s+)?(it|my\s+money)|remaining)\b/i;
const KEEP_BUFFER = /keep\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i;
const AMOUNT = /\$\s*([\d,]+(?:\.\d{1,2})?)/g;
const PAY_RENT = /\b(pay|send)\b[\s\w]{0,20}\brent\b/i;

// "pay Ama", "send $20 to Ama", "approve Ama", "Ama as a payee". Names are capitalised words.
const PAYEE_NAME = /\b(?:to|pay|approve|payee|payees)\s+([A-Z][a-zA-Z'-]{1,30})\b|\b([A-Z][a-zA-Z'-]{1,30})\s+as\s+(?:an?\s+)?(?:approved\s+)?payee\b/g;
const NOT_A_NAME = new Set(["Rent", "My", "The", "Me", "Pocket", "Keep", "Friday", "Monday", "Tuesday", "Wednesday", "Thursday", "Saturday", "Sunday", "It", "Them", "Him", "Her"]);

/** Payee names a goal approves, in order, without duplicates. */
export function payeesFromGoal(goalText: string): string[] {
  const out: string[] = [];
  for (const m of goalText.matchAll(PAYEE_NAME)) {
    const name = (m[1] ?? m[2])!;
    if (!NOT_A_NAME.has(name) && !out.some((n) => n.toLowerCase() === name.toLowerCase())) out.push(name);
  }
  return out.slice(0, 5);
}

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
    payeeLabel: PAY_RENT.test(text) ? "Rent" : spendPayee(text),
  });
}

/** "send $20 to Ama" or "pay Ama $20": the one named payee of a spend, if any. */
function spendPayee(text: string): string | undefined {
  const m = text.match(/\b(?:to|pay)\s+([A-Z][a-zA-Z'-]{1,30})\b/);
  return m && !NOT_A_NAME.has(m[1]!) ? m[1] : undefined;
}

/** Build a default fail-closed plan from chat goal text (Keep $200 beachhead). */
export function parseMoneyPlanFromGoal(goalText: string, opts?: { reserveFloorCents?: number }): MoneyPlan {
  const keep = goalText.match(KEEP_BUFFER);
  const reserveFloorCents = keep ? dollarsToCents(keep[1]!) : (opts?.reserveFloorCents ?? 20_000);
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
    allowlist: [{ label: "Rent" }, ...payeesFromGoal(goalText).map((label) => ({ label }))],
    steps,
  });
}

export function assertMoneyPlan(input: unknown): MoneyPlan {
  return MoneyPlanSchema.parse(input);
}
