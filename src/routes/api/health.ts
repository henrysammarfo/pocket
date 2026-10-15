import { createFileRoute } from "@tanstack/react-router";
import { privyConfigured } from "@/lib/auth/privy.server";

/** Readiness probe — names only, never secret values. */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const checks = {
          database: Boolean(process.env["DATABASE_URL"] || process.env["DATABASE_URL_UNPOOLED"] || process.env["POSTGRES_URL"]),
          privy: privyConfigured(),
          agentrouter: Boolean(process.env["AGENTROUTER_API_KEY"]),
          elevenlabs: Boolean(process.env["ELEVENLABS_API_KEY"]),
          monadRpc: Boolean(process.env["MONAD_RPC_URL"] || process.env["VITE_MONAD_RPC_URL"]),
          envioGraphql: Boolean(process.env["ENVIO_GRAPHQL_URL"]),
          envioToken: Boolean(process.env["ENVIO_API_TOKEN"]),
        };
        const ok = checks.database && checks.privy && checks.agentrouter && checks.monadRpc;
        return Response.json(
          {
            ok,
            service: "pocket",
            network: process.env["MONAD_NETWORK"] || "testnet",
            chainId: Number(process.env["MONAD_CHAIN_ID"] || 10143),
            checks,
          },
          { status: ok ? 200 : 503 },
        );
      },
    },
  },
});
