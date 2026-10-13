import { createFileRoute } from "@tanstack/react-router";
import { desc, eq } from "drizzle-orm";
import { authenticate, json } from "@/lib/ai/auth.server";
import { getDb } from "@/lib/db/client";
import { threads } from "../../../drizzle/schema";

export const Route = createFileRoute("/api/threads")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return json({ error: "Please sign in again." }, 401);
        const db = getDb();
        const rows = await db
          .select({ id: threads.id, title: threads.title, updated_at: threads.updatedAt })
          .from(threads)
          .where(eq(threads.memberId, auth.userId))
          .orderBy(desc(threads.updatedAt));
        return json({ threads: rows });
      },
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return json({ error: "Please sign in again." }, 401);
        const db = getDb();
        const [row] = await db
          .insert(threads)
          .values({ memberId: auth.userId })
          .returning({ id: threads.id });
        if (!row) return json({ error: "Could not create conversation" }, 500);
        return json({ id: row.id });
      },
    },
  },
});
