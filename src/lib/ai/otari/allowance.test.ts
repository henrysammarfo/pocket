import { describe, expect, it } from "vitest";
import { fetchAllowance, readAllowance } from "./allowance";
import { fakeFetch, jsonRes, testConfig } from "./test-helpers";

describe("readAllowance", () => {
  it("is new before the first request", () => {
    expect(readAllowance([], []).state).toBe("new");
  });
  it("is blocked when Otari says so", () => {
    expect(readAllowance([{ blocked: true }], []).state).toBe("blocked");
  });
  it("joins the end user to its budget", () => {
    const a = readAllowance([{ spend: 0.04, budget_id: "b1" }], [{ id: "b1", max_budget: 0.05, budget_duration: "1d" }]);
    expect(a).toMatchObject({ state: "low", spentUsd: 0.04, limitUsd: 0.05, period: "1d" });
    expect(a.usedFraction).toBeCloseTo(0.8);
  });
  it("is used up at the limit and ok below 80%", () => {
    expect(readAllowance([{ spend: 0.05, budget: { id: "b", max_budget: 0.05 } }], []).state).toBe("used");
    expect(readAllowance([{ spend: "0.01", budget: { max_budget: 0.05 } }], []).state).toBe("ok");
  });
  it("is unknown rather than guessed when fields are missing", () => {
    expect(readAllowance([{ requests: 3 }], []).state).toBe("unknown");
  });
});

describe("fetchAllowance", () => {
  it("reads the end user by its url-encoded Pocket id", async () => {
    const f = fakeFetch((c) => (c.url.includes("end-user-budgets") ? jsonRes([{ id: "b1", max_budget: 1 }]) : jsonRes([{ spend: 0.5, budget_id: "b1" }])));
    const a = await fetchAllowance("m-1", { config: testConfig(), fetch: f.fetch });
    expect(a.state).toBe("ok");
    expect(f.calls.map((c) => c.url)).toContain("https://otari.test/api/v1/end-users?external_id=pocket%3Am-1");
  });
});
