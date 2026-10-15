import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, createIdGenerator, streamText, type UIMessage } from "ai";
import { and, eq } from "drizzle-orm";
import { authenticate, json } from "./auth.server";
import { getDb } from "@/lib/db/client";
import { threadMessages, threads } from "../../../drizzle/schema";

const MODEL = process.env["AGENTROUTER_MODEL"] || "gpt-4o";
const BASE_URL = process.env["AGENTROUTER_BASE_URL"] || "https://agentrouter.org/v1";

const INSTRUCTIONS = `You are POCKET, a warm, sharp personal money assistant inside the POCKET app.
Members describe financial goals (saving for something, paying off debt, budgeting rent, building a reserve). Your job is to turn their goal into a clear, personalized money plan.

How to respond:
- If key facts are missing (income, fixed bills, deadline, current savings), make sensible stated assumptions, give a draft plan anyway, then ask at most 2 short follow-up questions.
- Structure plans in markdown with these sections: **Your goal** (one line), **The plan** (a short table: step, amount, when), **POCKET guardrails** (3-4 rules POCKET would enforce: protected reserve floor, spending cap, approved recipients, plan expiry), **This week** (1-3 concrete actions).
- Use the member's currency if they mention one; otherwise use $.
- Keep it conversational and short, like a great friend who is good with money. No lectures.
- Never promise fixed returns or guaranteed growth. Never claim money has actually moved: POCKET execution is a testnet demo. Mention briefly when relevant that this is guidance, not regulated financial advice.`;

export async function handleChat(request: Request) {
  const auth = await authenticate(request);
  if (!auth) return json({ error: "Please sign in again." }, 401);
  const apiKey = process.env["AGENTROUTER_API_KEY"];
  if (!apiKey) return json({ error: "AI is not configured (AGENTROUTER_API_KEY)." }, 500);

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

  const provider = createOpenAI({
    baseURL: BASE_URL,
    apiKey,
  });

  const result = streamText({
    model: provider.chat(MODEL),
    system: INSTRUCTIONS,
    messages: await convertToModelMessages(messages),
    abortSignal: request.signal,
  });

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: false,
    generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
    onFinish: async ({ responseMessage }) => {
      if (!responseMessage?.parts?.length) return;
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
    onError: (error) => {
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 402) return "AI credits are used up. Please top up AgentRouter and try again.";
      if (status === 429) return "POCKET is busy right now. Please try again in a moment.";
      console.error(error);
      return "Something went wrong creating your plan. Please try again.";
    },
  });
}
