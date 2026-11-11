import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import { streamExplainer } from "./explain-stream";
import { decodeAiState } from "./ai-states";
import { project, PROJECTION_PY } from "./otari/projection";
import { fakeFetch, jsonRes, ROUTED, sse, testConfig } from "./otari/test-helpers";

const msgs: UIMessage[] = [{ id: "u1", role: "user", parts: [{ type: "text", text: "Save $3,000 by June. I earn $2,800 and spend $1,900." }] }];

async function chunks(res: Response) {
  const text = await res.text();
  return text
    .split("\n")
    .filter((l) => l.startsWith("data: ") && l !== "data: [DONE]")
    .map((l) => JSON.parse(l.slice(6)) as Record<string, any>);
}

const input = { start: 0, income: 280_000, fixed: 190_000, goal: 300_000 };
const code = PROJECTION_PY.replace(/^INPUT = .*$/m, `INPUT = ${JSON.stringify(input)}`);

describe("streamExplainer", () => {
  it("streams text and ends with a receipt built from Otari's report", async () => {
    const f = fakeFetch(() =>
      sse(
        [
          { choices: [{ delta: { content: "**Your goal** " } }] },
          { choices: [{ delta: {} }], otari_tool_calls: [{ id: "otari_ci_1", type: "code_execution", status: "completed", code, stdout: JSON.stringify(project(input)), exit_code: 0 }] },
          { choices: [{ delta: { content: "4 months." }, finish_reason: "stop" }] },
        ],
        { headers: ROUTED },
      ),
    );
    let done: { outcome: string } | null = null;
    const res = streamExplainer({ messages: msgs, memberId: "m1", threadId: "t1", config: testConfig(), fetch: f.fetch, onDone: (r) => void (done = r) });
    const c = await chunks(res);
    expect(c.filter((x) => x["type"] === "text-delta").map((x) => x["delta"]).join("")).toBe("**Your goal** 4 months.");
    const receipt = c.find((x) => x["type"] === "data-receipt")!["data"];
    expect(receipt).toMatchObject({ model: "openai/gpt-oss-120b", fallback: true, attempts: 2, projection: "match" });
    expect(done).toMatchObject({ outcome: "ok" });

    const body = f.calls[0]!.body;
    expect(body["model"]).toBe("pocket-explain");
    expect(body["user"]).toBe("pocket:m1");
    expect(body["tools"]).toEqual([{ type: "otari_web_fetch" }, { type: "otari_code_execution" }]);
    const mcp = (body["mcp_servers"] as Record<string, unknown>[])[0]!;
    expect(mcp).toMatchObject({ name: "pocket-wallet", url: "https://pocket.test/api/mcp" });
    expect(String(mcp["authorization_token"])).toMatch(/^v1\./);
    expect((body["messages"] as { role: string }[])[0]!.role).toBe("system");
  });

  it("leaves the MCP server out without an https origin", async () => {
    const f = fakeFetch(() => sse([{ choices: [{ delta: { content: "ok" }, finish_reason: "stop" }] }]));
    await (streamExplainer({ messages: msgs, memberId: "m1", threadId: "t1", config: testConfig({ publicOrigin: "http://localhost:3000" }), fetch: f.fetch })).text();
    expect(f.calls[0]!.body["mcp_servers"]).toBeUndefined();
  });

  it("turns a budget refusal into the allowance state with its wait", async () => {
    const f = fakeFetch(() => jsonRes({ code: "budget_exceeded" }, 403, { "otari-error-code": "budget_exceeded", "otari-budget-scope": "user", "retry-after": "3600" }));
    let outcome = "";
    const c = await chunks(streamExplainer({ messages: msgs, memberId: "m1", threadId: "t1", config: testConfig(), fetch: f.fetch, onDone: (r) => void (outcome = r.outcome) }));
    const err = c.find((x) => x["type"] === "error")!;
    expect(decodeAiState(err["errorText"])).toEqual({ pocketAi: true, code: "allowance_used", retryAfterSec: 3600 });
    expect(outcome).toBe("allowance_used");
  });

  it("maps a guardrail block", async () => {
    const f = fakeFetch(() => jsonRes({ code: "guardrail_violation" }, 403, { "otari-error-code": "guardrail_violation" }));
    const c = await chunks(streamExplainer({ messages: msgs, memberId: "m1", threadId: "t1", config: testConfig(), fetch: f.fetch }));
    expect(decodeAiState(c.find((x) => x["type"] === "error")!["errorText"])!.code).toBe("guard_blocked");
  });

  it("closes the text part and reports an interrupted stream", async () => {
    const f = fakeFetch(() => sse([{ choices: [{ delta: { content: "half" } }] }], { done: false }));
    const c = await chunks(streamExplainer({ messages: msgs, memberId: "m1", threadId: "t1", config: testConfig(), fetch: f.fetch }));
    const types = c.map((x) => x["type"]);
    expect(types.indexOf("text-end")).toBeGreaterThan(types.indexOf("text-delta"));
    expect(decodeAiState(c.find((x) => x["type"] === "error")!["errorText"])!.code).toBe("models_down");
  });
});
