import { and, desc, eq } from "drizzle-orm";
import { authenticate, json } from "@/lib/ai/auth.server";
import { getDb } from "@/lib/db/client";
import { intents, moneyPlans, receipts, settlements } from "../../../drizzle/schema";
import { assertMoneyPlan } from "@/lib/policy/plan-parser";
import { parseIntentWithOtari } from "@/lib/ai/otari/intent";
import { readOtariConfig } from "@/lib/ai/otari/config";
import { buildReceipt } from "@/lib/ai/otari/receipt";
import { recordAiRequest } from "@/lib/ai/otari/record.server";
import { evaluatePolicy } from "@/lib/policy/policy-engine";
import { composeIntent } from "@/lib/policy/intent-composer";
import type { MoneyPlan } from "@/lib/policy/types";
import { resolvePrivyWallet } from "@/lib/auth/privy-wallet.server";
import { executeAgoraPay, readAusdBalanceCents } from "./agora";
import { executeKuruAllocate } from "./kuru";

type SettleBody = {
  planId?: string;
  text: string;
  source?: "typed" | "spoken" | "system";
  walletId?: string;
  walletAddress?: `0x${string}`;
};

export async function handleSettle(request: Request): Promise<Response> {
  const auth = await authenticate(request);
  if (!auth) return json({ error: "Please sign in again." }, 401);

  const body = (await request.json().catch(() => null)) as SettleBody | null;
  if (!body?.text?.trim()) return json({ error: "Missing settle text" }, 400);

  const db = getDb();
  const source = body.source ?? "typed";
  const userId = auth.userId;
  // Intent role through Otari; rules are the fail-closed fallback. The model
  // only reads the text: the PolicyEngine below makes the decision.
  const otariConfig = readOtariConfig();
  const parsed = await parseIntentWithOtari(body.text, source, userId, { config: otariConfig });
  const intent = parsed.intent;
  const aiIntent = {
    parsedBy: parsed.parsedBy,
    ...(parsed.fallbackReason ? { fallbackReason: parsed.fallbackReason } : {}),
    receipt: parsed.meta ? buildReceipt("intent", otariConfig.intentModel, parsed.meta, []) : null,
  };
  if (parsed.meta || parsed.fallbackReason !== "no_key") {
    void recordAiRequest({
      memberId: userId,
      role: "intent",
      policy: otariConfig.intentModel,
      outcome: parsed.parsedBy === "model" ? "ok" : (parsed.fallbackReason ?? "rules"),
      receipt: aiIntent.receipt ?? {},
    });
  }

  let planRow: {
    id: string;
    householdId: string;
    planJson: unknown;
    reserveFloorCents: number;
    status: string;
    expiresAt: Date | null;
  } | null = null;

  if (body.planId) {
    const [row] = await db
      .select({
        id: moneyPlans.id,
        householdId: moneyPlans.householdId,
        planJson: moneyPlans.planJson,
        reserveFloorCents: moneyPlans.reserveFloorCents,
        status: moneyPlans.status,
        expiresAt: moneyPlans.expiresAt,
      })
      .from(moneyPlans)
      .where(eq(moneyPlans.id, body.planId))
      .limit(1);
    planRow = row ?? null;
  } else {
    const [row] = await db
      .select({
        id: moneyPlans.id,
        householdId: moneyPlans.householdId,
        planJson: moneyPlans.planJson,
        reserveFloorCents: moneyPlans.reserveFloorCents,
        status: moneyPlans.status,
        expiresAt: moneyPlans.expiresAt,
      })
      .from(moneyPlans)
      .where(and(eq(moneyPlans.memberId, userId), eq(moneyPlans.status, "approved")))
      .orderBy(desc(moneyPlans.approvedAt))
      .limit(1);
    planRow = row ?? null;
  }

  let plan: MoneyPlan | null = null;
  if (planRow?.status === "approved") {
    try {
      plan = assertMoneyPlan({
        ...(planRow.planJson as object),
        reserveFloorCents: planRow.reserveFloorCents,
        expiresAt: planRow.expiresAt?.toISOString(),
      });
    } catch {
      plan = null;
    }
  }

  // The signing wallet id and the address must belong to the same wallet:
  // take both from Privy, never a Privy id with a stale address from the db.
  let walletId = body.walletId;
  let walletAddress = body.walletAddress;
  if (!walletId || !walletAddress) {
    const resolved = await resolvePrivyWallet(auth.privyUserId);
    if (resolved) {
      walletId = resolved.walletId || undefined;
      walletAddress = resolved.address;
    } else {
      walletAddress = walletAddress ?? (auth.member.walletAddress as `0x${string}` | null) ?? undefined;
    }
  }

  let balanceCents = plan?.reserveFloorCents ?? 0;
  if (walletAddress) {
    try {
      balanceCents = await readAusdBalanceCents(walletAddress);
    } catch (e) {
      console.error("[settle] balance read failed", e);
    }
  }

  const decision = evaluatePolicy(intent, { plan, balanceCents });

  if (!planRow) {
    return json({
      aiIntent,
      blocked: true,
      decision,
      screen: {
        message: intent.rawText,
        bufferCents: 0,
        nothingMoved: true,
        headline: "No approved plan",
      },
    });
  }

  const [intentRow] = await db
    .insert(intents)
    .values({
      planId: planRow.id,
      memberId: userId,
      source,
      rawText: intent.rawText,
      parsed: intent as unknown as Record<string, unknown>,
      status: decision.allowed ? "allowed" : "blocked",
      denyReason: decision.allowed ? null : decision.reason,
    })
    .returning({ id: intents.id });
  if (!intentRow) return json({ error: "intent persist failed" }, 500);

  if (!decision.allowed) {
    await db.insert(settlements).values({
      intentId: intentRow.id,
      planId: planRow.id,
      memberId: userId,
      rail: "blocked",
      status: "blocked",
      amountCents: intent.amountCents ?? 0,
      asset: "AUSD",
      receiptJson: { code: decision.code, reason: decision.reason },
    });
    await db.insert(receipts).values({
      householdId: planRow.householdId,
      memberId: userId,
      plainEnglish: decision.reason,
      kind: "blocked",
    });
    return json({
      aiIntent,
      blocked: true,
      decision,
      screen: {
        message: intent.rawText,
        bufferCents: decision.bufferRemainingCents,
        nothingMoved: true,
        headline: "Nothing moved",
        planCatch: plan?.steps.find((s) => s.action === "hold")?.label ?? `Keep $${(planRow.reserveFloorCents / 100).toFixed(0)}`,
      },
    });
  }

  if (!walletId || !walletAddress) {
    return json(
      {
        error: "Privy wallet required for live settlement",
        needsKey: "embedded wallet (auto-create on login) + gas sponsorship on Monad testnet",
      },
      503,
    );
  }

  const composed = composeIntent(intent, plan!);
  const leg = composed.legs[0]!;
  try {
    const exec =
      leg.rail === "kuru"
        ? await executeKuruAllocate({
            walletId,
            amountCents: leg.amountCents,
            fromAddress: walletAddress,
          })
        : await executeAgoraPay({
            walletId,
            fromAddress: walletAddress,
            amountCents: leg.amountCents,
            to: (leg.to ?? walletAddress) as `0x${string}`,
            mode: "transfer",
          });

    await db.update(intents).set({ status: "executed" }).where(eq(intents.id, intentRow.id));
    const [settlement] = await db
      .insert(settlements)
      .values({
        intentId: intentRow.id,
        planId: planRow.id,
        memberId: userId,
        rail: leg.rail,
        status: "confirmed",
        amountCents: leg.amountCents,
        asset: leg.asset,
        txHash: exec.txHash,
        explorerUrl: exec.explorerUrl,
        receiptJson: { composed },
      })
      .returning({ id: settlements.id });

    await db.insert(receipts).values({
      settlementId: settlement?.id,
      householdId: planRow.householdId,
      memberId: userId,
      plainEnglish: composed.plainEnglish,
      kind: "paid",
    });

    return json({
      aiIntent,
      blocked: false,
      decision,
      composed,
      settlement: { txHash: exec.txHash, explorerUrl: exec.explorerUrl },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Settlement failed";
    await db.update(intents).set({ status: "failed", denyReason: message }).where(eq(intents.id, intentRow.id));
    await db.insert(settlements).values({
      intentId: intentRow.id,
      planId: planRow.id,
      memberId: userId,
      rail: leg.rail,
      status: "failed",
      amountCents: leg.amountCents,
      asset: leg.asset,
      receiptJson: { error: message },
    });
    return json({ error: message }, 502);
  }
}
