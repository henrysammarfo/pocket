import { createFileRoute } from "@tanstack/react-router";
import { authenticate, json } from "@/lib/ai/auth.server";
import { readOtariConfig } from "@/lib/ai/otari/config";
import { runDrill } from "@/lib/ai/otari/drill";
import { recordAiRequest } from "@/lib/ai/otari/record.server";

/** Settings > Fallback test. One small request through the drill routing policy. */
export const Route = createFileRoute("/api/ai/drill")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return json({ error: "Please sign in again." }, 401);
        const config = readOtariConfig();
        if (!config.serviceKey) return json({ ok: false, state: "not_configured", receipt: null });
        const result = await runDrill(auth.userId, { config });
        await recordAiRequest({ memberId: auth.userId, role: "intent", policy: config.drillModel, outcome: result.ok ? "ok" : result.state, receipt: result.receipt ?? {} });
        return json(result);
      },
    },
  },
});
