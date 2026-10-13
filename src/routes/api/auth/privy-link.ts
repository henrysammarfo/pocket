import { createFileRoute } from "@tanstack/react-router";
import { verifyPrivyAccessToken } from "@/lib/auth/privy.server";
import { ensureMemberForPrivy } from "@/lib/db/members";

/**
 * Links a verified Privy user to a Neon member + household row.
 */
export const Route = createFileRoute("/api/auth/privy-link")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!auth) return Response.json({ error: "Missing Privy token" }, { status: 401 });

        const privyUser = await verifyPrivyAccessToken(auth);
        if (!privyUser) return Response.json({ error: "Invalid Privy session" }, { status: 401 });

        if (!process.env["DATABASE_URL"] && !process.env["DATABASE_URL_UNPOOLED"] && !process.env["POSTGRES_URL"]) {
          return Response.json(
            {
              error: "DATABASE_URL missing — attach Neon via Vercel Storage Marketplace",
              privyUserId: privyUser.userId,
              needsKey: "DATABASE_URL",
            },
            { status: 503 },
          );
        }

        try {
          const member = await ensureMemberForPrivy(privyUser);
          return Response.json({
            ok: true,
            userId: member.id,
            householdId: member.householdId,
            privyUserId: privyUser.userId,
            walletAddress: member.walletAddress ?? privyUser.walletAddress,
          });
        } catch (e) {
          console.error("[privy-link]", e);
          return Response.json(
            { error: e instanceof Error ? e.message : "Could not link member" },
            { status: 500 },
          );
        }
      },
    },
  },
});
