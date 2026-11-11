import { describe, expect, it } from "vitest";
import { buildReceipt } from "./receipt";
import { parseOtariHeaders } from "./headers";
import { project, PROJECTION_PY } from "./projection";
import { ROUTED } from "./test-helpers";

const input = { start: 0, income: 280_000, fixed: 190_000, goal: 300_000 };
const code = PROJECTION_PY.replace(/^INPUT = .*$/m, `INPUT = ${JSON.stringify(input)}`);

describe("buildReceipt", () => {
  it("records routing, tools, the ECB source and a matching projection", () => {
    const meta = parseOtariHeaders(new Headers({ ...ROUTED, "otari-guardrails": '[{"profile":"pocket-money-rules","mode":"block","valid":true,"score":0.02,"status":"ok"}]' }));
    const r = buildReceipt("explain", "pocket-explain", meta, [
      { id: "otari_wf_1", type: "web_fetch", status: "completed", url: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml" },
      { id: "otari_ci_1", type: "code_execution", status: "completed", code, stdout: JSON.stringify(project(input)) },
      { id: "otari_mcp_1", type: "mcp", status: "completed", server: "pocket-wallet", name: "get_balance" },
      { id: "otari_ci_2", type: "code_execution", status: "in_progress" },
    ]);
    expect(r).toMatchObject({ model: "openai/gpt-oss-120b", attempts: 2, fallback: true, guard: "passed", projection: "match", ratesSource: "ecb" });
    expect(r.tools.map((t) => t.label)).toEqual(["Read www.ecb.europa.eu", "Ran the numbers in a sandbox", "Checked your balance"]);
  });
  it("says not_run when no guardrail header came back and handles no metadata", () => {
    const r = buildReceipt("intent", "pocket-intent", null, []);
    expect(r).toMatchObject({ guard: "not_run", model: null, projection: null, ratesSource: null, tools: [] });
  });
  it("does not credit ECB for a failed fetch", () => {
    const r = buildReceipt("explain", "p", null, [{ id: "w", type: "web_fetch", status: "failed", url: "https://www.ecb.europa.eu/x" }]);
    expect(r.ratesSource).toBeNull();
    expect(r.tools[0]!.ok).toBe(false);
  });
  it("marks the lighter model only when it was not a fallback", () => {
    const light = parseOtariHeaders(new Headers({ "otari-model": "openai/gpt-oss-120b", "otari-fallback": "false" }));
    expect(buildReceipt("explain", "p", light, [], { lightModel: "gpt-oss-120b" }).lighter).toBe(true);
    const fb = parseOtariHeaders(new Headers({ "otari-model": "gpt-oss-120b", "otari-fallback": "true" }));
    expect(buildReceipt("explain", "p", fb, [], { lightModel: "gpt-oss-120b" }).lighter).toBe(false);
    const main = parseOtariHeaders(new Headers({ "otari-model": "deepseek-v4.1-flash" }));
    expect(buildReceipt("explain", "p", main, [], { lightModel: "gpt-oss-120b" }).lighter).toBe(false);
  });
});
