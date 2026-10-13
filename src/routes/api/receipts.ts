import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { authenticate, json } from "@/lib/ai/auth.server";
import { getDb } from "@/lib/db/client";
import { receipts } from "../../../drizzle/schema";
import { fetchEnvioReceipts } from "@/lib/settlement/envio";

export const Route = createFileRoute("/api/receipts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return json({ error: "Please sign in again." }, 401);

        let dbReceipts: { plainEnglish: string; kind: string }[] = [];
        if (auth.member.householdId) {
          const db = getDb();
          const rows = await db
            .select({
              plainEnglish: receipts.plainEnglish,
              kind: receipts.kind,
            })
            .from(receipts)
            .where(eq(receipts.householdId, auth.member.householdId))
            .orderBy(desc(receipts.createdAt))
            .limit(20);
          dbReceipts = rows;
        }

        const envio = await fetchEnvioReceipts(auth.userId).catch(() => []);
        const merged = [
          ...dbReceipts.map((r) => ({ plain_english: r.plainEnglish, kind: r.kind, source: "db" as const })),
          ...envio.map((r) => ({ plain_english: r.plainEnglish, kind: r.kind, source: "envio" as const })),
        ];
        return json({ receipts: merged });
      },
    },
  },
});
