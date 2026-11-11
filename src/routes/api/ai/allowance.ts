import { createFileRoute } from "@tanstack/react-router";
import { authenticate, json } from "@/lib/ai/auth.server";
import { fetchAllowance } from "@/lib/ai/otari/allowance";
import { readOtariConfig } from "@/lib/ai/otari/config";
import { OtariError } from "@/lib/ai/otari/errors";

/** The signed-in member's AI allowance, read live from Otari. */
export const Route = createFileRoute("/api/ai/allowance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return json({ error: "Please sign in again." }, 401);
        const config = readOtariConfig();
        if (!config.serviceKey) return json({ allowance: null, configured: false });
        try {
          return json({ allowance: await fetchAllowance(auth.userId, { config }), configured: true });
        } catch (e) {
          const status = e instanceof OtariError ? e.status : 0;
          console.error("[allowance]", status, e instanceof Error ? e.message : e);
          return json({ allowance: { state: "unknown", spentUsd: null, limitUsd: null, period: null, usedFraction: null }, configured: true });
        }
      },
    },
  },
});
