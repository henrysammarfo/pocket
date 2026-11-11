import { createFileRoute } from "@tanstack/react-router";
import { handleGuardValidate } from "@/lib/guard/service";

/** Otari guardrail mandate endpoint: POST /api/guard/validate. */
export const Route = createFileRoute("/api/guard/validate")({
  server: { handlers: { POST: ({ request }) => handleGuardValidate(request) } },
});
