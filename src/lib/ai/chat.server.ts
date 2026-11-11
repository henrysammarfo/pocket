import type { UIMessage } from "ai";
import { and, eq } from "drizzle-orm";
import { authenticate, json } from "./auth.server";
import { getDb } from "@/lib/db/client";
import { threadMessages, threads } from "../../../drizzle/schema";
import { encodeAiState } from "./ai-states";
import { readOtariConfig } from "./otari/config";
import { streamExplainer } from "./explain-stream";
import { recordAiRequest } from "./otari/record.server";

export async function handleChat(request: Request) {
  const auth = await authenticate(request);
  if (!auth) return json({ error: "Please sign in again." }, 401);
  const config = readOtariConfig();
  if (!config.serviceKey) return json({ error: encodeAiState("not_configured") }, 503);

  const body = (await request.json().catch(() => null)) as { messages?: UIMessage[]; threadId?: string } | null;
  const messages = body?.messages;
  const threadId = body?.threadId;
  if (!Array.isArray(messages) || !messages.length || typeof threadId !== "string") {
    return json({ error: "Invalid request" }, 400);
  }

  const db = getDb();
  const { userId } = auth;
  const [thread] = await db
    .select({ id: threads.id, title: threads.title })
    .from(threads)
    .where(and(eq(threads.id, threadId), eq(threads.memberId, userId)))
    .limit(1);
  if (!thread) return json({ error: "Conversation not found" }, 404);

  const last = messages[messages.length - 1];
  if (last?.role === "user") {
    await db
      .insert(threadMessages)
      .values({
        threadId,
        memberId: userId,
        messageId: last.id,
        role: "user",
        parts: last.parts as unknown as Record<string, unknown>[],
      })
      .onConflictDoUpdate({
        target: [threadMessages.threadId, threadMessages.messageId],
        set: { parts: last.parts as unknown as Record<string, unknown>[], role: "user" },
      });
    if (thread.title === "New money plan") {
      const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
      if (text) {
        await db.update(threads).set({ title: text.slice(0, 60), updatedAt: new Date() }).where(eq(threads.id, threadId));
      }
    }
  }
  await db.update(threads).set({ updatedAt: new Date() }).where(eq(threads.id, threadId));

  return streamExplainer({
    messages,
    memberId: userId,
    threadId,
    config,
    signal: request.signal,
    onDone: async ({ receipt, outcome, responseMessage }) => {
      await recordAiRequest({ memberId: userId, threadId, role: "explain", policy: config.explainModel, outcome, receipt: receipt ?? {} });
      if (!responseMessage?.parts?.some((p) => p.type === "text")) return;
      try {
        await db
          .insert(threadMessages)
          .values({
            threadId,
            memberId: userId,
            messageId: responseMessage.id,
            role: "assistant",
            parts: responseMessage.parts as unknown as Record<string, unknown>[],
          })
          .onConflictDoUpdate({
            target: [threadMessages.threadId, threadMessages.messageId],
            set: { parts: responseMessage.parts as unknown as Record<string, unknown>[], role: "assistant" },
          });
      } catch (error) {
        console.error("Failed to save assistant message", error);
      }
    },
  });
}
