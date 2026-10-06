import { createFileRoute } from "@tanstack/react-router";
import { authenticate, json } from "@/lib/ai/auth.server";
import { transcribe } from "@/lib/ai/transcribe.server";

const MAX = 20 * 1024 * 1024;

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return json({ error: "Please sign in again." }, 401);
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return json({ error: "AI is not configured." }, 500);
        const length = Number(request.headers.get("content-length") ?? 0);
        if (length > MAX + 1024 * 64) return json({ error: "Recording is too long." }, 413);
        const form = await request.formData().catch(() => null);
        const file = form?.get("file");
        if (!(file instanceof File) || !file.size) return json({ error: "No audio received." }, 400);
        try {
          const upstream = await transcribe(
            { baseURL: "https://ai.gateway.lovable.dev", apiKey, model: "openai/gpt-transcribe", maxFileBytes: MAX, audioOnly: false },
            file,
            { signal: request.signal },
          );
          return new Response(upstream.body, {
            status: upstream.status,
            headers: { "content-type": upstream.headers.get("content-type") ?? "text/event-stream" },
          });
        } catch (error) {
          if (request.signal.aborted) return new Response(null, { status: 499 });
          return json({ error: error instanceof Error ? error.message : "Transcription failed" }, 400);
        }
      },
    },
  },
});
