import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, createIdGenerator, streamText, type UIMessage } from "ai";
import type { Json } from "@/integrations/supabase/types";
import { authenticate, json } from "./auth.server";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./run-id.server";

const MODEL = "openai/gpt-6-astra";
const GATEWAY = "https://ai.gateway.lovable.dev/v1";

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
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) return json({ error: "AI is not configured." }, 500);

  const body = (await request.json().catch(() => null)) as { messages?: UIMessage[]; threadId?: string } | null;
  const messages = body?.messages;
  const threadId = body?.threadId;
  if (!Array.isArray(messages) || !messages.length || typeof threadId !== "string") return json({ error: "Invalid request" }, 400);

  const { supabase, userId } = auth;
  const { data: thread, error: threadError } = await supabase.from("threads").select("id,title").eq("id", threadId).maybeSingle();
  if (threadError || !thread) return json({ error: "Conversation not found" }, 404);

  const last = messages[messages.length - 1];
  if (last?.role === "user") {
    const { error } = await supabase.from("thread_messages").upsert(
      { thread_id: threadId, user_id: userId, message_id: last.id, role: "user", parts: last.parts as unknown as Json },
      { onConflict: "thread_id,message_id" },
    );
    if (error) return json({ error: "Could not save your message." }, 500);
    if (thread.title === "New money plan") {
      const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim();
      if (text) await supabase.from("threads").update({ title: text.slice(0, 60) }).eq("id", threadId);
    }
  }
  await supabase.from("threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);

  const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  const result = streamText({
    model: provider.responses(MODEL),
    instructions: INSTRUCTIONS,
    messages: await convertToModelMessages(messages),
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });

  const response = result.toUIMessageStreamResponse({
    originalMessages: messages,
    sendReasoning: true,
    generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
    onEnd: async ({ responseMessage }) => {
      if (!responseMessage?.parts?.length) return;
      const { error } = await supabase.from("thread_messages").upsert(
        { thread_id: threadId, user_id: userId, message_id: responseMessage.id, role: "assistant", parts: responseMessage.parts as unknown as Json },
        { onConflict: "thread_id,message_id" },
      );
      if (error) console.error("Failed to save assistant message", error);
    },
    onError: (error) => {
      const status = (error as { statusCode?: number })?.statusCode;
      if (status === 402) return "AI credits are used up for this workspace. Please add credits and try again.";
      if (status === 429) return "POCKET is busy right now. Please try again in a moment.";
      console.error(error);
      return "Something went wrong creating your plan. Please try again.";
    },
  });
  return withLovableAiGatewayRunIdHeader(response, runIdFetch);
}
