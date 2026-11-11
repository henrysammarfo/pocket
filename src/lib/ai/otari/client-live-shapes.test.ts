import { describe, expect, it } from "vitest";
import { otariChat, otariChatStream, otariTagsHeader, usageCost } from "./client";
import { fakeFetch, jsonRes, sse, testConfig } from "./test-helpers";

// Shapes observed from the live Otari gateway on 2026-11-11.
describe("Otari live shapes", () => {
  it("formats Otari-Tags as key=value pairs (a bare word is a 422)", () => {
    expect(otariTagsHeader({ app: "pocket", role: "intent" })).toBe("app=pocket,role=intent");
    expect(otariTagsHeader({ note: "a,b=c" })).toBe("note=a%2Cb%3Dc");
    expect(otariTagsHeader({})).toBeNull();
    expect(otariTagsHeader(undefined)).toBeNull();
  });
  it("reads the settled cost from usage.cost_usd when no cost header is sent", async () => {
    expect(usageCost({ cost_usd: "0.000028", estimated_cost: 2.8e-5 })).toBeCloseTo(0.000028);
    expect(usageCost({ estimated_cost: 0.001 })).toBe(0.001);
    expect(usageCost({})).toBeNull();
    const f = fakeFetch(() => jsonRes({ choices: [{ message: { content: "ok" } }], usage: { cost_usd: "0.000123" } }));
    const r = await otariChat({ model: "pocket-intent", messages: [] }, { config: testConfig(), fetch: f.fetch });
    expect(r.meta.costUsd).toBeCloseTo(0.000123);
  });
  it("asks a stream for usage and yields its cost", async () => {
    const f = fakeFetch(() => sse([{ choices: [{ delta: { content: "hi" }, finish_reason: "stop" }] }, { choices: [], usage: { cost_usd: "0.0004" } }]));
    const ev: { type: string; costUsd?: number }[] = [];
    for await (const e of otariChatStream({ model: "pocket-explain", messages: [] }, { config: testConfig(), fetch: f.fetch })) ev.push(e as never);
    expect(f.calls[0]!.body).toMatchObject({ stream_options: { include_usage: true } });
    expect(ev.find((e) => e.type === "usage")?.costUsd).toBeCloseTo(0.0004);
    expect(ev.at(-1)!.type).toBe("done");
  });
});

import { withoutMcpIfRefused } from "../explain-stream";
import { OtariError } from "./errors";

describe("withoutMcpIfRefused", () => {
  const refuse = new OtariError(400, null, "This workspace does not let a request name MCP servers by URL.", null);
  it("retries once without MCP servers when the workspace refuses them", async () => {
    const seen: number[] = [];
    async function* open(servers: unknown[]) {
      seen.push(servers.length);
      if (servers.length) throw refuse;
      yield "ok";
    }
    const out: string[] = [];
    for await (const v of withoutMcpIfRefused([{ name: "pocket-wallet" }], open)) out.push(v);
    expect(out).toEqual(["ok"]);
    expect(seen).toEqual([1, 0]);
  });
  it("passes other errors through and never retries them", async () => {
    let n = 0;
    async function* open(): AsyncGenerator<string> {
      n++;
      throw new OtariError(403, "budget_exceeded", "over", null);
    }
    await expect((async () => { for await (const _ of withoutMcpIfRefused([{}], open)) void _; })()).rejects.toBeInstanceOf(OtariError);
    expect(n).toBe(1);
  });
});

import { readAllowance } from "./allowance";

describe("readAllowance with live Otari shapes", () => {
  const budgets = [{ budget_id: "b1", name: "pocket-member-daily", max_budget: 0.5, budget_duration_sec: null, reset_alignment: "calendar_day", is_default: true }];
  it("joins the end user to its budget by budget_id", () => {
    const eu = [{ external_id: "pocket:m1", budget_id: "b1", blocked: false, spend: 0.042196, next_budget_reset_at: "2026-11-12T00:00:00+00:00" }];
    expect(readAllowance(eu, budgets)).toEqual({ state: "ok", spentUsd: 0.042196, limitUsd: 0.5, period: "daily", usedFraction: 0.084 });
  });
  it("shows the default budget for a member Otari has not seen yet", () => {
    expect(readAllowance([], budgets)).toEqual({ state: "new", spentUsd: 0, limitUsd: 0.5, period: "daily", usedFraction: 0 });
  });
});
