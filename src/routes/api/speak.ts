import { createFileRoute } from "@tanstack/react-router";
import { authenticate, json } from "@/lib/ai/auth.server";
import { synthesizeSpeech } from "@/lib/voice/elevenlabs.server";

export const Route = createFileRoute("/api/speak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return json({ error: "Please sign in again." }, 401);
        const body = (await request.json().catch(() => null)) as { text?: string } | null;
        if (!body?.text?.trim()) return json({ error: "text required" }, 400);
        try {
          const audio = await synthesizeSpeech(body.text.trim().slice(0, 500));
          return new Response(audio, {
            status: 200,
            headers: { "content-type": "audio/mpeg", "cache-control": "no-store" },
          });
        } catch (e) {
          return json({ error: e instanceof Error ? e.message : "Speak failed" }, 503);
        }
      },
    },
  },
});
