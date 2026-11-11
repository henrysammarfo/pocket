import { createIdGenerator, createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { encodeAiState } from "./ai-states";
import { otariChatStream, type FetchLike } from "./otari/client";
import type { OtariConfig } from "./otari/config";
import { OtariError } from "./otari/errors";
import { EXPLAIN_SYSTEM, explainTools, toChatMessages } from "./otari/explain";
import type { OtariMeta } from "./otari/headers";
import { buildReceipt, type AiReceipt } from "./otari/receipt";
import { mergeToolCalls, type OtariToolCall } from "./otari/tool-calls";
import { signMcpToken } from "@/lib/mcp/token";

/**
 * Stream the explainer's answer through Otari as an AI SDK UI message stream.
 * Every answer ends with a `data-receipt` part built from Otari's headers and
 * otari_tool_calls. Refusals become a typed AI state the chat renders.
 */
export function streamExplainer(args: {
  messages: UIMessage[];
  memberId: string;
  threadId: string;
  config: OtariConfig;
  signal?: AbortSignal;
  fetch?: FetchLike;
  onDone?: (r: { receipt: AiReceipt | null; outcome: string; responseMessage: UIMessage | null }) => Promise<void> | void;
}): Response {
  const { config } = args;
  let receipt: AiReceipt | null = null;
  let outcome = "ok";
  const stream = createUIMessageStream<UIMessage>({
    originalMessages: args.messages,
    generateId: createIdGenerator({ prefix: "msg", size: 16 }),
    execute: async ({ writer }) => {
      const textId = "t0";
      let meta: OtariMeta | null = null;
      const calls = new Map<string, OtariToolCall>();
      let started = false;
      const mcpToken = config.mcpSigningSecret ? signMcpToken(args.memberId, config.mcpSigningSecret) : null;
      const { tools, mcp_servers } = explainTools(config, mcpToken);
      try {
        for await (const ev of otariChatStream(
          {
            model: config.explainModel,
            memberId: args.memberId,
            temperature: 0.4,
            max_tokens: 900,
            tags: ["pocket:explain"],
            tools,
            mcp_servers,
            max_tool_iterations: 4,
            messages: [{ role: "system", content: EXPLAIN_SYSTEM }, ...toChatMessages(args.messages as never)],
          },
          { config, ...(args.signal ? { signal: args.signal } : {}), ...(args.fetch ? { fetch: args.fetch } : {}) },
        )) {
          if (ev.type === "meta") meta = ev.meta;
          else if (ev.type === "tools") mergeToolCalls(calls, ev.calls);
          else if (ev.type === "delta") {
            if (!started) {
              writer.write({ type: "text-start", id: textId });
              started = true;
            }
            writer.write({ type: "text-delta", id: textId, delta: ev.text });
          } else if (ev.type === "error") throw ev.error;
        }
        if (started) writer.write({ type: "text-end", id: textId });
        receipt = buildReceipt("explain", config.explainModel, meta, [...calls.values()]);
        writer.write({ type: "data-receipt", data: receipt });
      } catch (e) {
        if (started) writer.write({ type: "text-end", id: textId });
        const state = e instanceof OtariError ? e.state : "unknown";
        outcome = state;
        if (!(e instanceof OtariError)) console.error("[chat] explainer failed", e);
        receipt = e instanceof OtariError && e.meta ? buildReceipt("explain", config.explainModel, e.meta, [...calls.values()]) : null;
        writer.write({ type: "error", errorText: encodeAiState(state, e instanceof OtariError ? e.retryAfterSec : null) });
      }
    },
    onFinish: async ({ responseMessage }) => {
      await args.onDone?.({ receipt, outcome, responseMessage: responseMessage ?? null });
    },
  });
  return createUIMessageStreamResponse({ stream });
}

