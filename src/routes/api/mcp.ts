import { createFileRoute } from "@tanstack/react-router";
import { handleMcpRequest } from "@/lib/mcp/server";
import { walletData } from "@/lib/mcp/data.server";

const handle = (request: Request) =>
  handleMcpRequest(request, { secret: process.env["POCKET_MCP_SIGNING_SECRET"] ?? null, data: walletData });

/** Pocket wallet MCP server (read only). Otari's gateway is its client. */
export const Route = createFileRoute("/api/mcp")({
  server: { handlers: { POST: ({ request }) => handle(request), GET: ({ request }) => handle(request) } },
});
