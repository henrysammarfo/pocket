import { createFileRoute } from "@tanstack/react-router";
import { handleSettle } from "@/lib/settlement/settle.server";

export const Route = createFileRoute("/api/settle")({
  server: { handlers: { POST: ({ request }) => handleSettle(request) } },
});
