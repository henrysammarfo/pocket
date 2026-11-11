import type { OtariConfig } from "./config";
import type { FetchLike } from "./client";

export const testConfig = (over: Partial<OtariConfig> = {}): OtariConfig => ({
  baseUrl: "https://otari.test/api/v1",
  serviceKey: "svc_test",
  guardKey: null,
  intentModel: "pocket-intent",
  explainModel: "pocket-explain",
  guardModel: "pocket-guard",
  publicOrigin: "https://pocket.test",
  mcpSigningSecret: "s".repeat(40),
  ...over,
});

export type Captured = { url: string; init: RequestInit; body: Record<string, unknown> };

export function fakeFetch(respond: (c: Captured) => Response): { fetch: FetchLike; calls: Captured[] } {
  const calls: Captured[] = [];
  const f: FetchLike = async (url, init) => {
    const c = { url, init, body: init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {} };
    calls.push(c);
    return respond(c);
  };
  return { fetch: f, calls };
}

export function sse(chunks: unknown[], opts: { done?: boolean; headers?: Record<string, string>; split?: number } = {}): Response {
  const text = chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join("") + (opts.done === false ? "" : "data: [DONE]\n\n");
  const enc = new TextEncoder().encode(text);
  const size = opts.split ?? 7;
  const body = new ReadableStream<Uint8Array>({
    start(ctrl) {
      for (let i = 0; i < enc.length; i += size) ctrl.enqueue(enc.slice(i, i + size));
      ctrl.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream", ...(opts.headers ?? {}) } });
}

export const jsonRes = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

export const ROUTED = {
  "otari-request-id": "req_123",
  "otari-provider": "groq",
  "otari-model": "openai/gpt-oss-120b",
  "otari-attempt-count": "2",
  "otari-fallback": "true",
  "otari-response-duration-ms": "812",
  "otari-cost-usd": "0.000412",
};
