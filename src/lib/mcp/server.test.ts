import { describe, expect, it } from "vitest";
import { handleMcpRequest, TOOLS, type WalletData } from "./server";
import { signMcpToken, verifyMcpToken } from "./token";

const SECRET = "x".repeat(48);
const seen: string[] = [];
const data: WalletData = {
  getBalance: async (id) => (seen.push(id), { balanceCents: 123_45, asset: "AUSD", network: "Monad testnet" }),
  listActivity: async (id, limit) => (seen.push(id), Array.from({ length: Math.min(limit, 2) }, (_, i) => ({ text: `Paid rent ${i}`, kind: "paid", at: "2026-11-10T10:00:00.000Z" }))),
  listPayees: async () => [{ label: "Rent" }],
  getPlan: async () => ({ title: "Rent plan", reserveFloorCents: 50_000, steps: [{ label: "Pay rent", amountCents: 120_000, when: "Friday" }] }),
};

const rpc = (method: string, params?: unknown, opts: { token?: string | null; id?: number | null } = {}) => {
  const token = opts.token === undefined ? signMcpToken("member-1", SECRET) : opts.token;
  const body: Record<string, unknown> = { jsonrpc: "2.0", method, ...(params ? { params } : {}) };
  if (opts.id !== null) body["id"] = opts.id ?? 1;
  return new Request("https://pocket.test/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
};
const call = async (r: Request) => {
  const res = await handleMcpRequest(r, { secret: SECRET, data });
  return { status: res.status, body: res.status === 202 ? null : ((await res.json()) as Record<string, any>) };
};

describe("mcp token", () => {
  it("verifies a fresh token and rejects tampering and expiry", () => {
    const t = signMcpToken("member-1", SECRET, 300, 1_000_000);
    expect(verifyMcpToken(t, SECRET, 1_000_000)).toEqual({ ok: true, memberId: "member-1" });
    expect(verifyMcpToken(t.replace("v1.", "v1.A"), SECRET, 1_000_000).ok).toBe(false);
    expect(verifyMcpToken(t, "y".repeat(48), 1_000_000)).toEqual({ ok: false, reason: "bad_signature" });
    expect(verifyMcpToken(t, SECRET, 1_000_000 + 301_000)).toEqual({ ok: false, reason: "expired" });
    expect(verifyMcpToken("garbage", SECRET)).toEqual({ ok: false, reason: "malformed" });
  });
  it("refuses a short secret", () => {
    expect(() => signMcpToken("m", "short")).toThrow();
  });
});

describe("wallet MCP server", () => {
  it("initializes with tools capability and negotiates the version", async () => {
    const r = await call(rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "otari", version: "1" } }));
    expect(r.body!["result"].protocolVersion).toBe("2025-03-26");
    expect(r.body!["result"].capabilities.tools).toBeDefined();
    const u = await call(rpc("initialize", { protocolVersion: "1999-01-01" }));
    expect(u.body!["result"].protocolVersion).toBe("2025-06-18");
  });
  it("accepts notifications with 202", async () => {
    expect((await call(rpc("notifications/initialized", undefined, { id: null }))).status).toBe(202);
  });
  it("lists four read-only tools and no write tool", async () => {
    const r = await call(rpc("tools/list"));
    const names = r.body!["result"].tools.map((t: { name: string }) => t.name);
    expect(names).toEqual(["get_balance", "list_activity", "list_payees", "get_plan"]);
    expect(TOOLS.every((t) => t.annotations.readOnlyHint)).toBe(true);
    expect(names.some((n: string) => /^(send|pay|transfer|withdraw|move)/.test(n))).toBe(false);
  });
  it("reads only the member named in the token", async () => {
    seen.length = 0;
    const r = await call(rpc("tools/call", { name: "get_balance", arguments: { memberId: "someone-else" } }));
    expect(r.body!["result"].content[0].text).toBe("$123.45 AUSD on Monad testnet.");
    expect(seen).toEqual(["member-1"]);
  });
  it("clamps list_activity limit and formats plans", async () => {
    const a = await call(rpc("tools/call", { name: "list_activity", arguments: { limit: 500 } }));
    expect(a.body!["result"].structuredContent.activity).toHaveLength(2);
    const p = await call(rpc("tools/call", { name: "get_plan", arguments: {} }));
    expect(p.body!["result"].content[0].text).toBe("Rent plan. Keep $500.00 protected. Steps: Pay rent $1200.00 (Friday).");
  });
  it("errors on unknown tools and methods", async () => {
    expect((await call(rpc("tools/call", { name: "send_money", arguments: {} }))).body!["error"].code).toBe(-32602);
    expect((await call(rpc("resources/list"))).body!["error"].code).toBe(-32601);
  });
  it("returns isError when a read fails, without leaking the exception", async () => {
    const res = await handleMcpRequest(rpc("tools/call", { name: "get_balance" }), { secret: SECRET, data: { ...data, getBalance: async () => { throw new Error("rpc url secret"); } } });
    const body = (await res.json()) as Record<string, any>;
    expect(body["result"].isError).toBe(true);
    expect(JSON.stringify(body)).not.toContain("secret");
  });
  it("requires a valid bearer token", async () => {
    expect((await call(rpc("tools/list", undefined, { token: null }))).status).toBe(401);
    expect((await call(rpc("tools/list", undefined, { token: "v1.bad.1.sig" }))).status).toBe(401);
  });
  it("is 405 on GET and 503 without a secret", async () => {
    expect((await handleMcpRequest(new Request("https://pocket.test/api/mcp"), { secret: SECRET, data })).status).toBe(405);
    expect((await handleMcpRequest(rpc("tools/list"), { secret: null, data })).status).toBe(503);
  });
  it("rejects bad JSON", async () => {
    const r = new Request("https://pocket.test/api/mcp", { method: "POST", headers: { authorization: `Bearer ${signMcpToken("m", SECRET)}` }, body: "{" });
    expect((await handleMcpRequest(r, { secret: SECRET, data })).status).toBe(400);
  });
});
