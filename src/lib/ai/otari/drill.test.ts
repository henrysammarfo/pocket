import { describe, expect, it } from "vitest";
import { runDrill } from "./drill";
import { fakeFetch, jsonRes, ROUTED, testConfig } from "./test-helpers";

describe("runDrill", () => {
  it("calls the drill policy and reports the fallback Otari saw", async () => {
    const f = fakeFetch(() => jsonRes({ choices: [{ message: { content: "ready" } }] }, 200, ROUTED));
    const r = await runDrill("m1", { config: testConfig(), fetch: f.fetch });
    expect(f.calls[0]!.body["model"]).toBe("pocket-intent-drill");
    expect(r.ok && r.receipt.fallback).toBe(true);
    expect(r.ok && r.receipt.attempts).toBe(2);
  });
  it("maps a refusal to a state", async () => {
    const f = fakeFetch(() => jsonRes({ code: "all_candidates_rejected" }, 400, { "otari-error-code": "all_candidates_rejected" }));
    const r = await runDrill("m1", { config: testConfig(), fetch: f.fetch });
    expect(r).toMatchObject({ ok: false, state: "models_down" });
  });
});
