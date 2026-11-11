import { describe, expect, it } from "vitest";
import { parseIntentWithOtari, reconcileIntent } from "./intent";
import { fakeFetch, jsonRes, ROUTED, testConfig } from "./test-helpers";

const modelSays = (out: unknown) => fakeFetch(() => jsonRes({ choices: [{ message: { content: JSON.stringify(out) } }] }, 200, ROUTED));

describe("reconcileIntent", () => {
  it("accepts a model reading whose amount is in the text", () => {
    const r = reconcileIntent("Pay Ama $25.50 for lunch", "typed", { kind: "pay", amount_cents: 2550, payee_label: "Ama" });
    expect(r.parsedBy).toBe("model");
    expect(r.intent).toMatchObject({ kind: "pay", amountCents: 2550, payeeLabel: "Ama" });
  });
  it("rejects an invented amount and uses the rules", () => {
    const r = reconcileIntent("Pay Ama for lunch", "typed", { kind: "pay", amount_cents: 99_900, payee_label: "Ama" });
    expect(r.parsedBy).toBe("rules");
    expect(r.fallbackReason).toBe("amount_not_in_text");
    expect(r.intent.amountCents).toBeUndefined();
  });
  it("forces send_rest when the rules see it, whatever the model says", () => {
    const r = reconcileIntent("Send the rest to my cousin", "typed", { kind: "pay", amount_cents: null, payee_label: "cousin" });
    expect(r.intent.kind).toBe("send_rest");
    expect(r.fallbackReason).toBe("send_rest_rule");
  });
  it("falls back on output that breaks the schema", () => {
    expect(reconcileIntent("pay $5", "typed", { kind: "steal" }).parsedBy).toBe("rules");
    expect(reconcileIntent("pay $5", "typed", null).fallbackReason).toBe("invalid_output");
  });
  it("accepts amounts written with commas", () => {
    const r = reconcileIntent("Pay rent $1,200", "typed", { kind: "pay", amount_cents: 120_000, payee_label: "Rent" });
    expect(r.parsedBy).toBe("model");
  });
});

describe("parseIntentWithOtari", () => {
  it("asks the intent policy for strict JSON at temperature 0", async () => {
    const f = modelSays({ kind: "pay", amount_cents: 5000, payee_label: "Rent" });
    const r = await parseIntentWithOtari("Pay rent $50", "typed", "m1", { config: testConfig(), fetch: f.fetch });
    expect(r.parsedBy).toBe("model");
    expect(r.meta?.model).toBe("openai/gpt-oss-120b");
    const body = f.calls[0]!.body;
    expect(body).toMatchObject({ model: "pocket-intent", temperature: 0, user: "pocket:m1" });
    expect((body["response_format"] as { type: string }).type).toBe("json_schema");
  });
  it("uses the rules with no key, without calling Otari", async () => {
    const f = modelSays({});
    const r = await parseIntentWithOtari("Pay rent $50", "typed", "m1", { config: testConfig({ serviceKey: null }), fetch: f.fetch });
    expect(r).toMatchObject({ parsedBy: "rules", fallbackReason: "no_key" });
    expect(f.calls).toHaveLength(0);
  });
  it("uses the rules when Otari refuses, keeping the refusal metadata", async () => {
    const f = fakeFetch(() => jsonRes({ code: "budget_exceeded" }, 403, { "otari-error-code": "budget_exceeded", "otari-budget-scope": "user" }));
    const r = await parseIntentWithOtari("Pay rent $50", "typed", "m1", { config: testConfig(), fetch: f.fetch });
    expect(r).toMatchObject({ parsedBy: "rules", fallbackReason: "model_error" });
    expect(r.meta?.budgetScope).toBe("user");
    expect(r.intent.amountCents).toBe(5000);
  });
  it("tolerates non-JSON model text", async () => {
    const f = fakeFetch(() => jsonRes({ choices: [{ message: { content: "sure! pay 50" } }] }));
    const r = await parseIntentWithOtari("Pay rent $50", "typed", "m1", { config: testConfig(), fetch: f.fetch });
    expect(r.fallbackReason).toBe("invalid_output");
  });
});
