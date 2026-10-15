import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "./policy-engine";
import { parseMoneyPlanFromGoal, parseSpendIntent } from "./plan-parser";

const plan = parseMoneyPlanFromGoal("Pay rent $1200 and keep $200");

describe("PolicyEngine", () => {
  it("blocks send the rest", () => {
    const intent = parseSpendIntent("Send the rest");
    const d = evaluatePolicy(intent, { plan, balanceCents: 50_000 });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe("SEND_REST");
  });

  it("blocks dipping below reserve", () => {
    const intent = parseSpendIntent("Pay rent $400");
    intent.kind = "pay";
    intent.amountCents = 40_000;
    intent.payeeLabel = "Rent";
    const d = evaluatePolicy(intent, { plan, balanceCents: 45_000 });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe("RESERVE_FLOOR");
  });

  it("allows in-plan rent when buffer remains", () => {
    const intent = parseSpendIntent("Pay rent $1200");
    intent.kind = "pay";
    intent.amountCents = 120_000;
    intent.payeeLabel = "Rent";
    const d = evaluatePolicy(intent, { plan, balanceCents: 200_000 });
    expect(d.allowed).toBe(true);
  });

  it("denies without plan", () => {
    const intent = parseSpendIntent("Pay rent $100");
    const d = evaluatePolicy(intent, { plan: null, balanceCents: 10_000 });
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.code).toBe("NO_PLAN");
  });
});
