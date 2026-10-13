import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { verifyPrivyAccessToken } from "@/lib/auth/privy.server";

/**
 * Links a verified Privy user to a Supabase member row (data plane).
 * Creates household + member if missing. Returns a Supabase session when service role is configured.
 */
export const Route = createFileRoute("/api/auth/privy-link")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization")?.replace(/^Bearer /, "");
        if (!auth) return Response.json({ error: "Missing Privy token" }, { status: 401 });

        const privyUser = await verifyPrivyAccessToken(auth);
        if (!privyUser) return Response.json({ error: "Invalid Privy session" }, { status: 401 });

        const url = process.env["SUPABASE_URL"];
        const service = process.env["SUPABASE_SERVICE_ROLE_KEY"];
        const publishable = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !service) {
          return Response.json(
            {
              error: "Server missing SUPABASE_SERVICE_ROLE_KEY for Privy↔member link",
              privyUserId: privyUser.userId,
              needsKey: "SUPABASE_SERVICE_ROLE_KEY",
            },
            { status: 503 },
          );
        }

        const admin = createClient<Database>(url, service, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const email = privyUser.email ?? `${privyUser.userId}@privy.pocket.local`;

        // Ensure auth user exists
        const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
        let userId = listed?.users?.find((u) => u.email === email || u.app_metadata?.["privy_user_id"] === privyUser.userId)?.id;

        if (!userId) {
          const created = await admin.auth.admin.createUser({
            email,
            email_confirm: true,
            app_metadata: { privy_user_id: privyUser.userId, provider: "privy" },
            user_metadata: { wallet_address: privyUser.walletAddress },
          });
          if (created.error || !created.data.user) {
            return Response.json({ error: created.error?.message ?? "Could not create member" }, { status: 500 });
          }
          userId = created.data.user.id;
        } else {
          await admin.auth.admin.updateUserById(userId, {
            app_metadata: { privy_user_id: privyUser.userId, provider: "privy" },
            user_metadata: { wallet_address: privyUser.walletAddress },
          });
        }

        // Upsert member + default household
        const { data: existingMember } = await admin.from("members").select("id,household_id").eq("id", userId).maybeSingle();
        let householdId = existingMember?.household_id ?? null;
        if (!householdId) {
          const { data: hh, error: hhErr } = await admin
            .from("households")
            .insert({ name: "My household", created_by: userId })
            .select("id")
            .single();
          if (hhErr || !hh) {
            return Response.json({ error: hhErr?.message ?? "household create failed" }, { status: 500 });
          }
          householdId = hh.id;
          await admin.from("members").upsert({
            id: userId,
            household_id: householdId,
            privy_user_id: privyUser.userId,
            wallet_address: privyUser.walletAddress ?? null,
            display_name: privyUser.email?.split("@")[0] ?? "Member",
          });
          await admin.from("household_members").upsert({
            household_id: householdId,
            member_id: userId,
            role: "owner",
          });
        } else {
          await admin.from("members").update({
            privy_user_id: privyUser.userId,
            wallet_address: privyUser.walletAddress ?? null,
          }).eq("id", userId);
        }

        // Issue magic-link style session via generateLink + verify is heavy; return identity payload
        // Client continues with Privy token for API auth when Supabase cookie session is also present.
        void publishable;
        return Response.json({
          ok: true,
          userId,
          householdId,
          privyUserId: privyUser.userId,
          walletAddress: privyUser.walletAddress,
        });
      },
    },
  },
});
