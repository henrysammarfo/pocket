/**
 * Otari reports the tools it ran itself (web fetch, code execution, MCP) in
 * `otari_tool_calls` on a chat completion and on each streamed chunk.
 * See Otari api-reference.md "Gateway tool calls on Chat Completions".
 */
export type OtariToolCall = {
  id: string;
  type: "web_search" | "web_fetch" | "code_execution" | "mcp" | string;
  status: "in_progress" | "completed" | "failed" | string;
  url?: string;
  query?: string;
  code?: string;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  server?: string;
  name?: string;
  output?: string;
  error?: { tag?: string | null; retryable?: boolean | null } | null;
};

export function readToolCalls(payload: unknown): OtariToolCall[] {
  if (typeof payload !== "object" || payload === null) return [];
  const list = (payload as Record<string, unknown>)["otari_tool_calls"];
  if (!Array.isArray(list)) return [];
  return list.filter(
    (c): c is OtariToolCall =>
      typeof c === "object" && c !== null && typeof (c as OtariToolCall).id === "string" && typeof (c as OtariToolCall).type === "string",
  );
}

/** Later entries for the same id replace earlier ones (in_progress, then completed). */
export function mergeToolCalls(into: Map<string, OtariToolCall>, calls: OtariToolCall[]): void {
  for (const c of calls) into.set(c.id, { ...into.get(c.id), ...c });
}

/** The short, member-safe summary of one tool call shown on the receipt strip. */
export type ToolChip = { kind: "fetch" | "code" | "mcp" | "search" | "other"; label: string; ok: boolean };

export function toolChip(c: OtariToolCall): ToolChip {
  const ok = c.status === "completed";
  switch (c.type) {
    case "web_fetch": {
      let host = "the web";
      try {
        if (c.url) host = new URL(c.url).hostname;
      } catch {
        /* keep default */
      }
      return { kind: "fetch", label: `Read ${host}`, ok };
    }
    case "code_execution":
      return { kind: "code", label: ok ? "Ran the numbers in a sandbox" : "Sandbox run failed", ok };
    case "mcp":
      return { kind: "mcp", label: `Checked ${humanTool(c.name)}`, ok };
    case "web_search":
      return { kind: "search", label: "Searched the web", ok };
    default:
      return { kind: "other", label: "Used a tool", ok };
  }
}

function humanTool(name: string | undefined): string {
  switch (name) {
    case "get_balance":
      return "your balance";
    case "list_activity":
      return "your activity";
    case "list_payees":
      return "your payees";
    case "get_plan":
      return "your plan";
    default:
      return "your wallet";
  }
}
