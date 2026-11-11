import { createParser } from "eventsource-parser";
import { endUserId, readOtariConfig, type OtariConfig } from "./config";
import { OtariError, otariErrorFromResponse } from "./errors";
import { parseOtariHeaders, type OtariMeta } from "./headers";
import { readToolCalls, type OtariToolCall } from "./tool-calls";

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  /** Pocket member id. Sent as Otari's `user` so each member is an end user with a budget. */
  memberId?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: unknown;
  tools?: unknown[];
  mcp_servers?: unknown[];
  max_tool_iterations?: number;
  /** Otari cost-attribution tags, sent as `Otari-Tags: key=value,...` (never forwarded to the provider). */
  tags?: Record<string, string>;
};

export type OtariClientOptions = {
  config?: OtariConfig;
  /** Which key: the member-facing service key or the guard service's own key. */
  key?: "service" | "guard";
  fetch?: FetchLike;
  signal?: AbortSignal;
};

function buildBody(req: ChatRequest, stream: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = { model: req.model, messages: req.messages, stream };
  // Otari reports a chat request's settled cost in `usage.cost_usd`; a stream only sends usage when asked.
  if (stream) body["stream_options"] = { include_usage: true };
  if (req.memberId) body["user"] = endUserId(req.memberId);
  if (req.temperature != null) body["temperature"] = req.temperature;
  if (req.max_tokens != null) body["max_tokens"] = req.max_tokens;
  if (req.response_format) body["response_format"] = req.response_format;
  if (req.tools?.length) body["tools"] = req.tools;
  if (req.mcp_servers?.length) body["mcp_servers"] = req.mcp_servers;
  if (req.max_tool_iterations != null) body["max_tool_iterations"] = req.max_tool_iterations;
  return body;
}

function resolve(opts: OtariClientOptions) {
  const config = opts.config ?? readOtariConfig();
  const key = opts.key === "guard" ? config.guardKey : config.serviceKey;
  if (!key) throw new OtariError(401, "not_configured", "Otari key is not set", null);
  return { config, key, fetchImpl: opts.fetch ?? ((i: string, init: RequestInit) => fetch(i, init)) };
}

/** Otari wants comma-separated key=value pairs, percent-encoded. A bare word is a 422. */
export function otariTagsHeader(tags: Record<string, string> | undefined): string | null {
  if (!tags) return null;
  const pairs = Object.entries(tags)
    .filter(([k, v]) => k && v)
    .slice(0, 16)
    .map(([k, v]) => `${encodeURIComponent(k.slice(0, 64))}=${encodeURIComponent(v.slice(0, 512))}`);
  return pairs.length ? pairs.join(",") : null;
}

function headersFor(key: string, req: ChatRequest): Record<string, string> {
  const h: Record<string, string> = { authorization: `Bearer ${key}`, "content-type": "application/json" };
  const tags = otariTagsHeader(req.tags);
  if (tags) h["otari-tags"] = tags;
  return h;
}

/** Cost from the body's `usage.cost_usd` when the Otari-Cost-USD header is absent (chat completions send it there). */
export function usageCost(usage: unknown): number | null {
  if (!usage || typeof usage !== "object") return null;
  const u = usage as Record<string, unknown>;
  const raw = u["cost_usd"] ?? u["estimated_cost"];
  const n = typeof raw === "string" ? Number(raw) : typeof raw === "number" ? raw : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function withUsageCost(meta: OtariMeta, usage: unknown): OtariMeta {
  if (meta.costUsd != null) return meta;
  const c = usageCost(usage);
  return c == null ? meta : { ...meta, costUsd: c };
}

export type ChatResult = { text: string; meta: OtariMeta; toolCalls: OtariToolCall[] };

/** One non-streamed chat completion through Otari. Throws OtariError on refusal. */
export async function otariChat(req: ChatRequest, opts: OtariClientOptions = {}): Promise<ChatResult> {
  const { config, key, fetchImpl } = resolve(opts);
  const res = await fetchImpl(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: headersFor(key, req),
    body: JSON.stringify(buildBody(req, false)),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });
  const meta = parseOtariHeaders(res.headers);
  if (!res.ok) throw await otariErrorFromResponse(res, meta);
  const json = (await res.json()) as { choices?: { message?: { content?: string | null } }[]; usage?: unknown };
  const text = json.choices?.[0]?.message?.content ?? "";
  return { text, meta: withUsageCost(meta, json.usage), toolCalls: readToolCalls(json) };
}

export type StreamEvent =
  | { type: "meta"; meta: OtariMeta }
  | { type: "delta"; text: string }
  | { type: "tools"; calls: OtariToolCall[] }
  | { type: "usage"; costUsd: number }
  | { type: "error"; error: OtariError }
  | { type: "done"; finishReason: string | null };

/**
 * Streamed chat completion through Otari, as an async iterator of events.
 * Refusals before the stream opens throw OtariError; failures after it opens
 * arrive as an `error` event (Otari sends a stream error event, status 200).
 */
export async function* otariChatStream(req: ChatRequest, opts: OtariClientOptions = {}): AsyncGenerator<StreamEvent> {
  const { config, key, fetchImpl } = resolve(opts);
  const res = await fetchImpl(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { ...headersFor(key, req), accept: "text/event-stream" },
    body: JSON.stringify(buildBody(req, true)),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });
  const meta = parseOtariHeaders(res.headers);
  if (!res.ok) throw await otariErrorFromResponse(res, meta);
  yield { type: "meta", meta };
  if (!res.body) {
    yield { type: "done", finishReason: null };
    return;
  }

  const queue: StreamEvent[] = [];
  let finishReason: string | null = null;
  let ended = false;
  const parser = createParser({
    onEvent: (ev) => {
      if (ev.data === "[DONE]") {
        ended = true;
        return;
      }
      let chunk: Record<string, unknown>;
      try {
        chunk = JSON.parse(ev.data) as Record<string, unknown>;
      } catch {
        return;
      }
      const err = chunk["error"];
      if (err && typeof err === "object") {
        const e = err as Record<string, unknown>;
        const code = typeof e["code"] === "string" ? e["code"] : "provider_error";
        const message = typeof e["message"] === "string" ? e["message"] : "Stream error";
        queue.push({ type: "error", error: new OtariError(200, code, message, meta) });
        return;
      }
      const cost = usageCost(chunk["usage"]);
      if (cost != null) queue.push({ type: "usage", costUsd: cost });
      const calls = readToolCalls(chunk);
      if (calls.length) queue.push({ type: "tools", calls });
      const choices = chunk["choices"];
      if (Array.isArray(choices) && choices[0]) {
        const c = choices[0] as { delta?: { content?: string | null }; finish_reason?: string | null };
        const t = c.delta?.content;
        if (t) queue.push({ type: "delta", text: t });
        if (c.finish_reason) finishReason = c.finish_reason;
      }
    },
  });

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  for (;;) {
    const { done, value } = await reader.read();
    if (value) parser.feed(dec.decode(value, { stream: true }));
    while (queue.length) yield queue.shift()!;
    if (done || ended) break;
  }
  if (finishReason == null && !ended) {
    // Closed without a finish reason or [DONE]: Otari calls this an interrupted stream.
    yield { type: "error", error: new OtariError(200, "provider_stream_interrupted", "Stream ended early", meta) };
    return;
  }
  yield { type: "done", finishReason };
}

/** GET a service-key route (end users, budgets). */
export async function otariGet(path: string, opts: OtariClientOptions = {}): Promise<{ status: number; body: unknown; meta: OtariMeta }> {
  const { config, key, fetchImpl } = resolve(opts);
  const res = await fetchImpl(`${config.baseUrl}${path}`, {
    method: "GET",
    headers: { authorization: `Bearer ${key}` },
    ...(opts.signal ? { signal: opts.signal } : {}),
  });
  const meta = parseOtariHeaders(res.headers);
  if (!res.ok) throw await otariErrorFromResponse(res, meta);
  return { status: res.status, body: (await res.json()) as unknown, meta };
}
