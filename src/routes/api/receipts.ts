import { createFileRoute } from "@tanstack/react-router";
import { authenticate, json } from "@/lib/ai/auth.server";
import { fetchEnvioReceipts } from "@/lib/settlement/envio";

export const Route = createFileRoute("/api/receipts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return json({ error: "Please sign in again." }, 401);
        const { supabase, userId } = auth;

        const { data: member } = await supabase.from("members").select("household_id").eq("id", userId).maybeSingle();
        let dbReceipts: { plain_english: string; kind: string; created_at: string; envio_entity_id: string | null }[] = [];
        if (member?.household_id) {
          const { data } = await supabase
            .from("receipts")
            .select("plain_english,kind,created_at,envio_entity_id")
            .eq("household_id", member.household_id)
            .order("created_at", { ascending: false })
            .limit(20);
          dbReceipts = data ?? [];
        }

        const envio = await fetchEnvioReceipts(userId).catch(() => []);
        const merged = [
          ...dbReceipts.map((r) => ({ plain_english: r.plain_english, kind: r.kind, source: "db" as const })),
          ...envio.map((r) => ({ plain_english: r.plainEnglish, kind: r.kind, source: "envio" as const })),
        ];
        return json({ receipts: merged });
      },
    },
  },
});
