import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { authenticate, json } from "@/lib/ai/auth.server";
import { getDb } from "@/lib/db/client";
import { aiRequests } from "../../../../drizzle/schema";

/** The member's recent AI receipts: which model answered, fallbacks, tools. */
export const Route = createFileRoute("/api/ai/receipts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return json({ error: "Please sign in again." }, 401);
        try {
          const rows = await getDb()
            .select({ role: aiRequests.role, policy: aiRequests.policy, outcome: aiRequests.outcome, receipt: aiRequests.receipt, createdAt: aiRequests.createdAt })
            .from(aiRequests)
            .where(eq(aiRequests.memberId, auth.userId))
            .orderBy(desc(aiRequests.createdAt))
            .limit(30);
          return json({ receipts: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
        } catch {
          return json({ receipts: [] });
        }
      },
    },
  },
});
