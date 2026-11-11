import { createIdGenerator, createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { encodeAiState } from "./ai-states";
import { otariChatStream, type FetchLike } from "./otari/client";
import type { OtariConfig } from "./otari/config";
import { OtariError } from "./otari/errors";
import { EXPLAIN_SYSTEM, explainTools, toChatMessages } from "./otari/explain";
import type { OtariMeta } from "./otari/headers";
import { buildReceipt, type AiReceipt } from "./otari/receipt";
import { mergeToolCalls, toolChip, type OtariToolCall } from "./otari/tool-calls";
import { checkOutput } from "./otari/output-check";
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
      let streamCost: number | null = null;
      const settled = (): OtariMeta | null => (meta && meta.costUsd == null && streamCost != null ? { ...meta, costUsd: streamCost } : meta);
      const calls = new Map<string, OtariToolCall>();
      let started = false;
      let answer = "";
      const mcpToken = config.mcpSigningSecret ? signMcpToken(args.memberId, config.mcpSigningSecret) : null;
      const { tools, mcp_servers } = explainTools(config, mcpToken);
      try {
        for await (const ev of withoutMcpIfRefused(mcp_servers, (servers) => otariChatStream(
          {
            model: config.explainModel,
            memberId: args.memberId,
            temperature: 0.4,
            max_tokens: 2000,
            tags: { app: "pocket", role: "explain" },
            tools,
            mcp_servers: servers,
            max_tool_iterations: 4,
            messages: [{ role: "system", content: EXPLAIN_SYSTEM }, ...toChatMessages(args.messages as never)],
          },
          { config, ...(args.signal ? { signal: args.signal } : {}), ...(args.fetch ? { fetch: args.fetch } : {}) },
        ))) {
          if (ev.type === "meta") meta = ev.meta;
          else if (ev.type === "usage") streamCost = ev.costUsd;
          else if (ev.type === "tools") {
            mergeToolCalls(calls, ev.calls);
            // Live chips while tools run; replaced by the receipt at the end.
            writer.write({ type: "data-tools", id: "tools", data: [...calls.values()].map((c) => ({ ...toolChip(c), running: c.status === "in_progress" })), transient: true });
          }
          else if (ev.type === "delta") {
            if (!started) {
              writer.write({ type: "text-start", id: textId });
              started = true;
            }
            writer.write({ type: "text-delta", id: textId, delta: ev.text });
            answer += ev.text;
          } else if (ev.type === "error") throw ev.error;
        }
        if (started) writer.write({ type: "text-end", id: textId });
        receipt = buildReceipt("explain", config.explainModel, settled(), [...calls.values()], { lightModel: config.lightModel, output: checkOutput(answer) });
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


/**
 * A workspace that does not let requests name MCP servers by URL answers 400
 * before anything streams. Rather than lose the answer, ask once more without
 * the wallet server: web fetch and code execution still work, and the receipt
 * simply shows no wallet tools.
 */
export async function* withoutMcpIfRefused<T>(servers: unknown[], open: (servers: unknown[]) => AsyncGenerator<T>): AsyncGenerator<T> {
  if (!servers.length) {
    yield* open(servers);
    return;
  }
  const first = open(servers);
  let head: IteratorResult<T>;
  try {
    head = await first.next();
  } catch (e) {
    if (e instanceof OtariError && e.status === 400 && /mcp server/i.test(e.message)) {
      console.warn("[chat] workspace refuses request MCP servers; answering without wallet tools");
      yield* open([]);
      return;
    }
    throw e;
  }
  if (head.done) return;
  yield head.value;
  yield* first;
}
