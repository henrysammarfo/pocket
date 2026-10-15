import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import { authenticate, json } from "@/lib/ai/auth.server";
import { getDb } from "@/lib/db/client";
import { ensureMemberForPrivy } from "@/lib/db/members";
import { verifyPrivyAccessToken } from "@/lib/auth/privy.server";
import { parseMoneyPlanFromGoal } from "@/lib/policy/plan-parser";
import { householdMembers, households, members, moneyPlans, planRules } from "../../../../drizzle/schema";

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

        const db = getDb();
        let householdId = auth.member.householdId;
        if (!householdId) {
          const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
          const privy = await verifyPrivyAccessToken(token);
          if (!privy) return json({ error: "Please sign in again." }, 401);
          const member = await ensureMemberForPrivy(privy);
          householdId = member.householdId;
          if (!householdId) {
            const [hh] = await db
              .insert(households)
              .values({ name: "My household", createdBy: auth.userId })
              .returning({ id: households.id });
            if (!hh) return json({ error: "household failed" }, 500);
            householdId = hh.id;
            await db.update(members).set({ householdId }).where(eq(members.id, auth.userId));
            await db.insert(householdMembers).values({
              householdId,
              memberId: auth.userId,
              role: "owner",
            });
          }
        }

        const plan = parseMoneyPlanFromGoal(
          body.goalText,
          body.reserveFloorCents != null ? { reserveFloorCents: body.reserveFloorCents } : undefined,
        );

        const insertValues: typeof moneyPlans.$inferInsert = {
          householdId,
          memberId: auth.userId,
          title: plan.title,
          status: "approved",
          currency: plan.currency,
          reserveFloorCents: plan.reserveFloorCents,
          approvedAt: new Date(),
          planJson: plan as unknown as Record<string, unknown>,
        };
        if (body.threadId) insertValues.threadId = body.threadId;
        if (plan.spendingCapCents != null) insertValues.spendingCapCents = plan.spendingCapCents;
        if (plan.expiresAt) insertValues.expiresAt = new Date(plan.expiresAt);

        const [row] = await db.insert(moneyPlans).values(insertValues).returning({ id: moneyPlans.id });
        if (!row) return json({ error: "plan create failed" }, 500);

        await db.insert(planRules).values([
          {
            planId: row.id,
            kind: "reserve_floor",
            label: `Keep $${(plan.reserveFloorCents / 100).toFixed(0)}`,
            config: { cents: plan.reserveFloorCents },
            pinned: true,
          },
          ...plan.allowlist.map((p) => ({
            planId: row.id,
            kind: "allowlist_payee" as const,
            label: p.label,
            config: p as unknown as Record<string, unknown>,
            pinned: true,
          })),
        ]);

        return json({ ok: true, planId: row.id, plan });
      },
    },
  },
});
