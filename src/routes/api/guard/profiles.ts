import { createFileRoute } from "@tanstack/react-router";
import { handleGuardProfiles } from "@/lib/guard/service";

/** Optional profile list Otari's dashboard reads: GET /api/guard/profiles. */
export const Route = createFileRoute("/api/guard/profiles")({
  server: { handlers: { GET: ({ request }) => handleGuardProfiles(request) } },
});
