import { describe, expect, it } from "vitest";
import { otariChat, otariChatStream, otariGet } from "./client";
import { OtariError } from "./errors";
import { fakeFetch, jsonRes, ROUTED, sse, testConfig } from "./test-helpers";

describe("otariChat", () => {
  it("sends the member as an Otari end user, with the policy as model", async () => {
    const f = fakeFetch(() => jsonRes({ choices: [{ message: { content: "hi" } }] }, 200, ROUTED));
    const r = await otariChat({ model: "pocket-intent", memberId: "m1", messages: [{ role: "user", content: "x" }], tags: { app: "pocket", role: "intent" } }, { config: testConfig(), fetch: f.fetch });
    expect(r.text).toBe("hi");
    expect(r.meta.fallback).toBe(true);
    const c = f.calls[0]!;
    expect(c.url).toBe("https://otari.test/api/v1/chat/completions");
    expect(c.body).toMatchObject({ model: "pocket-intent", user: "pocket:m1", stream: false });
    expect((c.init.headers as Record<string, string>)["authorization"]).toBe("Bearer svc_test");
    expect((c.init.headers as Record<string, string>)["otari-tags"]).toBe("app=pocket,role=intent");
  });
  it("uses the guard key for the guard role", async () => {
    const f = fakeFetch(() => jsonRes({ choices: [{ message: { content: "{}" } }] }));
    await otariChat({ model: "pocket-guard", messages: [] }, { config: testConfig({ guardKey: "grd_test" }), key: "guard", fetch: f.fetch });
    expect((f.calls[0]!.init.headers as Record<string, string>)["authorization"]).toBe("Bearer grd_test");
  });
  it("throws a typed error on refusal", async () => {
    const f = fakeFetch(() => jsonRes({ detail: "blocked", code: "guardrail_violation" }, 403, { "otari-error-code": "guardrail_violation" }));
    await expect(otariChat({ model: "m", messages: [] }, { config: testConfig(), fetch: f.fetch })).rejects.toMatchObject({ state: "guard_blocked" });
  });
  it("refuses without a key and never calls the network", async () => {
    const f = fakeFetch(() => jsonRes({}));
    await expect(otariChat({ model: "m", messages: [] }, { config: testConfig({ serviceKey: null }), fetch: f.fetch })).rejects.toBeInstanceOf(OtariError);
    expect(f.calls).toHaveLength(0);
  });
});

async function collect(it: AsyncGenerator<unknown>) {
  const out: unknown[] = [];
  for await (const e of it) out.push(e);
  return out;
}

describe("otariChatStream", () => {
  it("yields meta, deltas across split chunks, tool calls and done", async () => {
    const f = fakeFetch(() =>
      sse(
        [
          { choices: [{ delta: { content: "Hel" } }] },
          { choices: [{ delta: {} }], otari_tool_calls: [{ id: "otari_wf_1", type: "web_fetch", status: "completed", url: "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml" }] },
          { choices: [{ delta: { content: "lo" }, finish_reason: "stop" }] },
        ],
        { headers: ROUTED, split: 5 },
      ),
    );
    const ev = (await collect(otariChatStream({ model: "pocket-explain", messages: [] }, { config: testConfig(), fetch: f.fetch }))) as { type: string; text?: string }[];
    expect(ev[0]!.type).toBe("meta");
    expect(ev.filter((e) => e.type === "delta").map((e) => e.text).join("")).toBe("Hello");
    expect(ev.some((e) => e.type === "tools")).toBe(true);
    expect(ev.at(-1)).toEqual({ type: "done", finishReason: "stop" });
    expect(f.calls[0]!.body["stream"]).toBe(true);
  });
  it("turns a stream error event into an error", async () => {
    const f = fakeFetch(() => sse([{ choices: [{ delta: { content: "a" } }] }, { error: { code: "provider_error", message: "boom" } }]));
    const ev = (await collect(otariChatStream({ model: "m", messages: [] }, { config: testConfig(), fetch: f.fetch }))) as { type: string; error?: OtariError }[];
    const err = ev.find((e) => e.type === "error");
    expect(err?.error?.state).toBe("models_down");
  });
  it("flags a stream that ends without a finish reason", async () => {
    const f = fakeFetch(() => sse([{ choices: [{ delta: { content: "a" } }] }], { done: false }));
    const ev = (await collect(otariChatStream({ model: "m", messages: [] }, { config: testConfig(), fetch: f.fetch }))) as { type: string; error?: OtariError }[];
    expect(ev.at(-1)!.type).toBe("error");
    expect(ev.at(-1)!.error!.code).toBe("provider_stream_interrupted");
  });
  it("throws before streaming when Otari refuses", async () => {
    const f = fakeFetch(() => jsonRes({ code: "budget_exceeded" }, 403, { "otari-error-code": "budget_exceeded", "otari-budget-scope": "user", "retry-after": "90" }));
    await expect(collect(otariChatStream({ model: "m", messages: [] }, { config: testConfig(), fetch: f.fetch }))).rejects.toMatchObject({ state: "allowance_used", retryAfterSec: 90 });
  });
});

describe("otariGet", () => {
  it("GETs with the service key", async () => {
    const f = fakeFetch(() => jsonRes([{ id: "e1" }]));
    const r = await otariGet("/end-users?external_id=pocket%3Am1", { config: testConfig(), fetch: f.fetch });
    expect(r.body).toEqual([{ id: "e1" }]);
    expect(f.calls[0]!.url).toBe("https://otari.test/api/v1/end-users?external_id=pocket%3Am1");
    expect(f.calls[0]!.init.method).toBe("GET");
  });
});
