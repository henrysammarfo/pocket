import { createFileRoute } from "@tanstack/react-router";
import { authenticate, json } from "@/lib/ai/auth.server";
import { parseMoneyPlanFromGoal } from "@/lib/policy/plan-parser";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/plans/approve")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return json({ error: "Please sign in again." }, 401);
        const body = (await request.json().catch(() => null)) as {
          goalText?: string;
          threadId?: string;
          reserveFloorCents?: number;
        } | null;
        if (!body?.goalText?.trim()) return json({ error: "goalText required" }, 400);

        const { supabase, userId } = auth;
        let householdId: string | null = null;
        const { data: member } = await supabase.from("members").select("id,household_id").eq("id", userId).maybeSingle();
        householdId = member?.household_id ?? null;
        if (!householdId) {
          const { data: hh, error } = await supabase
            .from("households")
            .insert({ name: "My household", created_by: userId })
            .select("id")
            .single();
          if (error || !hh) return json({ error: error?.message ?? "household failed" }, 500);
          householdId = hh.id;
          await supabase.from("members").upsert({
            id: userId,
            household_id: householdId,
            display_name: "Member",
          });
          await supabase.from("household_members").upsert({
            household_id: householdId,
            member_id: userId,
            role: "owner",
          });
        }

        const plan = parseMoneyPlanFromGoal(
          body.goalText,
          body.reserveFloorCents != null ? { reserveFloorCents: body.reserveFloorCents } : undefined,
        );
        const { data: row, error: planErr } = await supabase
          .from("money_plans")
          .insert({
            household_id: householdId,
            member_id: userId,
            thread_id: body.threadId ?? null,
            title: plan.title,
            status: "approved",
            currency: plan.currency,
            reserve_floor_cents: plan.reserveFloorCents,
            spending_cap_cents: plan.spendingCapCents ?? null,
            expires_at: plan.expiresAt ?? null,
            approved_at: new Date().toISOString(),
            plan_json: plan as unknown as Json,
          })
          .select("id")
          .single();
        if (planErr || !row) return json({ error: planErr?.message ?? "plan create failed" }, 500);

        await supabase.from("plan_rules").insert([
          {
            plan_id: row.id,
            kind: "reserve_floor",
            label: `Keep $${(plan.reserveFloorCents / 100).toFixed(0)}`,
            config: { cents: plan.reserveFloorCents } as unknown as Json,
            pinned: true,
          },
          ...plan.allowlist.map((p) => ({
            plan_id: row.id,
            kind: "allowlist_payee" as const,
            label: p.label,
            config: p as unknown as Json,
            pinned: true,
          })),
        ]);

        return json({ ok: true, planId: row.id, plan });
      },
    },
  },
});
