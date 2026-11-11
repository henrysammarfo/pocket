import { verifyMcpToken } from "./token";

/**
 * Pocket wallet MCP server: read-only, streamable HTTP (JSON responses),
 * MCP protocol revision 2025-06-18. Otari's gateway is the client; it calls
 * these tools inside the explainer's tool loop. Nothing here can move money:
 * there is no write tool, by design.
 */
export const MCP_PROTOCOL_VERSION = "2025-06-18";
export const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

export type WalletData = {
  getBalance(memberId: string): Promise<{ balanceCents: number; asset: string; network: string } | null>;
  listActivity(memberId: string, limit: number): Promise<{ text: string; kind: string; at: string }[]>;
  listPayees(memberId: string): Promise<{ label: string; address?: string }[]>;
  getPlan(memberId: string): Promise<{ title: string; reserveFloorCents: number; steps: { label: string; amountCents: number; when?: string }[] } | null>;
};

export const TOOLS = [
  {
    name: "get_balance",
    title: "Balance",
    description: "The member's current spendable balance in cents, with asset and network.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "list_activity",
    title: "Recent activity",
    description: "The member's most recent Pocket receipts, newest first: payments, blocks and plan approvals.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 20, default: 10 } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "list_payees",
    title: "Approved payees",
    description: "Payees on the member's approved plan allowlist. Only these can ever be paid.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "get_plan",
    title: "Approved plan",
    description: "The member's approved money plan: its Keep (protected reserve floor) and its steps.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
] as const;

type JsonRpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

const rpcResult = (id: JsonRpc["id"], result: unknown) => ({ jsonrpc: "2.0" as const, id: id ?? null, result });
const rpcError = (id: JsonRpc["id"], code: number, message: string) => ({ jsonrpc: "2.0" as const, id: id ?? null, error: { code, message } });

const jsonResponse = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...extra } });

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;

async function callTool(name: string, args: Record<string, unknown>, memberId: string, data: WalletData) {
  const text = (t: string, structured: unknown) => ({ content: [{ type: "text", text: t }], structuredContent: structured, isError: false });
  switch (name) {
    case "get_balance": {
      const b = await data.getBalance(memberId);
      if (!b) return text("No wallet is linked yet.", { balanceCents: null });
      return text(`${usd(b.balanceCents)} ${b.asset} on ${b.network}.`, b);
    }
    case "list_activity": {
      const raw = Number(args["limit"] ?? 10);
      const limit = Number.isInteger(raw) ? Math.min(20, Math.max(1, raw)) : 10;
      const rows = await data.listActivity(memberId, limit);
      return text(rows.length ? rows.map((r) => `${r.at.slice(0, 10)} ${r.kind}: ${r.text}`).join("\n") : "No activity yet.", { activity: rows });
    }
    case "list_payees": {
      const rows = await data.listPayees(memberId);
      return text(rows.length ? rows.map((p) => p.label).join(", ") : "No approved payees yet.", { payees: rows });
    }
    case "get_plan": {
      const p = await data.getPlan(memberId);
      if (!p) return text("No approved plan yet.", { plan: null });
      const steps = p.steps.map((s) => `${s.label} ${usd(s.amountCents)}${s.when ? ` (${s.when})` : ""}`).join("; ");
      return text(`${p.title}. Keep ${usd(p.reserveFloorCents)} protected. Steps: ${steps}.`, { plan: p });
    }
    default:
      return null;
  }
}

export async function handleMcpRequest(request: Request, deps: { secret: string | null; data: WalletData; now?: number }): Promise<Response> {
  if (request.method === "GET") return new Response(null, { status: 405, headers: { allow: "POST" } });
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  if (!deps.secret) return jsonResponse(rpcError(null, -32001, "MCP server is not configured"), 503);

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonResponse(rpcError(null, -32001, "Missing bearer token"), 401, { "www-authenticate": "Bearer" });
  const check = verifyMcpToken(token, deps.secret, deps.now);
  if (!check.ok) return jsonResponse(rpcError(null, -32001, `Token ${check.reason}`), 401, { "www-authenticate": "Bearer" });

  let msg: JsonRpc;
  try {
    msg = (await request.json()) as JsonRpc;
  } catch {
    return jsonResponse(rpcError(null, -32700, "Parse error"), 400);
  }
  if (Array.isArray(msg)) return jsonResponse(rpcError(null, -32600, "Batching is not supported"), 400);
  if (msg?.jsonrpc !== "2.0" || typeof msg.method !== "string") return jsonResponse(rpcError(msg?.id, -32600, "Invalid request"), 400);

  // Notifications get 202 and no body.
  if (msg.id === undefined) return new Response(null, { status: 202 });

  switch (msg.method) {
    case "initialize": {
      const asked = typeof msg.params?.["protocolVersion"] === "string" ? (msg.params["protocolVersion"] as string) : MCP_PROTOCOL_VERSION;
      return jsonResponse(
        rpcResult(msg.id, {
          protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : MCP_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "pocket-wallet", title: "Pocket wallet (read only)", version: "1.0.0" },
          instructions: "Read-only view of one Pocket member's wallet. No tool moves money.",
        }),
      );
    }
    case "ping":
      return jsonResponse(rpcResult(msg.id, {}));
    case "tools/list":
      return jsonResponse(rpcResult(msg.id, { tools: TOOLS }));
    case "tools/call": {
      const name = msg.params?.["name"];
      const args = (msg.params?.["arguments"] as Record<string, unknown> | undefined) ?? {};
      if (typeof name !== "string") return jsonResponse(rpcError(msg.id, -32602, "Missing tool name"));
      try {
        const out = await callTool(name, args, check.memberId, deps.data);
        if (!out) return jsonResponse(rpcError(msg.id, -32602, `Unknown tool: ${name}`));
        return jsonResponse(rpcResult(msg.id, out));
      } catch (e) {
        console.error("[mcp] tool failed", name, e);
        return jsonResponse(rpcResult(msg.id, { content: [{ type: "text", text: "Pocket could not read that right now." }], isError: true }));
      }
    }
    default:
      return jsonResponse(rpcError(msg.id, -32601, `Method not found: ${msg.method}`));
  }
}
