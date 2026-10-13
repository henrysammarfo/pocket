import { createFileRoute } from "@tanstack/react-router";
import { and, asc, eq } from "drizzle-orm";
import { authenticate, json } from "@/lib/ai/auth.server";
import { getDb } from "@/lib/db/client";
import { threadMessages, threads } from "../../../drizzle/schema";

export const Route = createFileRoute("/api/threads/$threadId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await authenticate(request);
        if (!auth) return json({ error: "Please sign in again." }, 401);
        const db = getDb();
        const [thread] = await db
          .select({ id: threads.id })
          .from(threads)
          .where(and(eq(threads.id, params.threadId), eq(threads.memberId, auth.userId)))
          .limit(1);
        if (!thread) return json({ error: "Not found" }, 404);

        const messages = await db
          .select({
            message_id: threadMessages.messageId,
            role: threadMessages.role,
            parts: threadMessages.parts,
          })
          .from(threadMessages)
          .where(eq(threadMessages.threadId, params.threadId))
          .orderBy(asc(threadMessages.createdAt));
        return json({ messages });
      },
      DELETE: async ({ request, params }) => {
        const auth = await authenticate(request);
        if (!auth) return json({ error: "Please sign in again." }, 401);
        const db = getDb();
        await db
          .delete(threads)
          .where(and(eq(threads.id, params.threadId), eq(threads.memberId, auth.userId)));
        return json({ ok: true });
      },
    },
  },
});
