import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { authenticate, json } from "@/lib/ai/auth.server";
import { verifyPrivyAccessToken } from "@/lib/auth/privy.server";
import { parseSpendIntent, assertMoneyPlan } from "@/lib/policy/plan-parser";
import { evaluatePolicy } from "@/lib/policy/policy-engine";
import { composeIntent } from "@/lib/policy/intent-composer";
import type { MoneyPlan } from "@/lib/policy/types";
import { executeAgoraPay, readAusdBalanceCents } from "./agora";
import { executeKuruAllocate } from "./kuru";

type SettleBody = {
  planId?: string;
  text: string;
  source?: "typed" | "spoken" | "system";
  walletId?: string;
  walletAddress?: `0x${string}`;
};

function adminClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"] || process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function resolveUser(request: Request): Promise<{ userId: string; privyWallet?: `0x${string}` } | null> {
  const auth = await authenticate(request);
  if (auth) return { userId: auth.userId };
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return null;
  const privy = await verifyPrivyAccessToken(token);
  if (!privy) return null;
  const admin = adminClient();
  const { data: member } = await admin.from("members").select("id,wallet_address").eq("privy_user_id", privy.userId).maybeSingle();
  if (!member) return null;
  const wallet = (member.wallet_address as `0x${string}` | null) ?? privy.walletAddress;
  return wallet ? { userId: member.id, privyWallet: wallet } : { userId: member.id };
}

export async function handleSettle(request: Request): Promise<Response> {
  const user = await resolveUser(request);
  if (!user) return json({ error: "Please sign in again." }, 401);

  const body = (await request.json().catch(() => null)) as SettleBody | null;
  if (!body?.text?.trim()) return json({ error: "Missing settle text" }, 400);

  const admin = adminClient();
  const source = body.source ?? "typed";
  const intent = parseSpendIntent(body.text, source);

  let planRow = null as {
    id: string;
    household_id: string;
    plan_json: Json;
    reserve_floor_cents: number;
    status: string;
    expires_at: string | null;
  } | null;

  if (body.planId) {
    const { data } = await admin.from("money_plans").select("id,household_id,plan_json,reserve_floor_cents,status,expires_at").eq("id", body.planId).maybeSingle();
    planRow = data;
  } else {
    const { data } = await admin
      .from("money_plans")
      .select("id,household_id,plan_json,reserve_floor_cents,status,expires_at")
      .eq("member_id", user.userId)
      .eq("status", "approved")
      .order("approved_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    planRow = data;
  }

  let plan: MoneyPlan | null = null;
  if (planRow?.status === "approved") {
    try {
      plan = assertMoneyPlan({
        ...(planRow.plan_json as object),
        reserveFloorCents: planRow.reserve_floor_cents,
        expiresAt: planRow.expires_at ?? undefined,
      });
    } catch {
      plan = null;
    }
  }

  const walletAddress = body.walletAddress ?? user.privyWallet;
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

  const { data: intentRow, error: intentErr } = await admin
    .from("intents")
    .insert({
      plan_id: planRow.id,
      member_id: user.userId,
      source,
      raw_text: intent.rawText,
      parsed: intent as unknown as Json,
      status: decision.allowed ? "allowed" : "blocked",
      deny_reason: decision.allowed ? null : decision.reason,
    })
    .select("id")
    .single();
  if (intentErr || !intentRow) return json({ error: intentErr?.message ?? "intent persist failed" }, 500);

  if (!decision.allowed) {
    await admin.from("settlements").insert({
      intent_id: intentRow.id,
      plan_id: planRow.id,
      member_id: user.userId,
      rail: "blocked",
      status: "blocked",
      amount_cents: intent.amountCents ?? 0,
      asset: "AUSD",
      receipt_json: { code: decision.code, reason: decision.reason } as unknown as Json,
    });
    await admin.from("receipts").insert({
      household_id: planRow.household_id,
      member_id: user.userId,
      plain_english: decision.reason,
      kind: "blocked",
    });
    return json({
      blocked: true,
      decision,
      screen: {
        message: intent.rawText,
        bufferCents: decision.bufferRemainingCents,
        nothingMoved: true,
        headline: "Nothing moved",
        planCatch: plan?.steps.find((s) => s.action === "hold")?.label ?? `Keep $${(planRow.reserve_floor_cents / 100).toFixed(0)}`,
      },
    });
  }

  if (!body.walletId || !walletAddress) {
    return json(
      {
        error: "Privy wallet required for live settlement",
        needsKey: "walletId + walletAddress from Privy embedded wallet",
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
            walletId: body.walletId,
            amountCents: leg.amountCents,
            fromAddress: walletAddress,
          })
        : await executeAgoraPay({
            walletId: body.walletId,
            fromAddress: walletAddress,
            amountCents: leg.amountCents,
            to: (leg.to ?? walletAddress) as `0x${string}`,
            mode: "transfer",
          });

    await admin.from("intents").update({ status: "executed" }).eq("id", intentRow.id);
    const { data: settlement } = await admin
      .from("settlements")
      .insert({
        intent_id: intentRow.id,
        plan_id: planRow.id,
        member_id: user.userId,
        rail: leg.rail,
        status: "confirmed",
        amount_cents: leg.amountCents,
        asset: leg.asset,
        tx_hash: exec.txHash,
        explorer_url: exec.explorerUrl,
        receipt_json: { composed } as unknown as Json,
      })
      .select("id")
      .single();

    await admin.from("receipts").insert({
      settlement_id: settlement?.id ?? null,
      household_id: planRow.household_id,
      member_id: user.userId,
      plain_english: composed.plainEnglish,
      kind: "paid",
    });

    return json({
      blocked: false,
      decision,
      composed,
      settlement: { txHash: exec.txHash, explorerUrl: exec.explorerUrl },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Settlement failed";
    await admin.from("intents").update({ status: "failed", deny_reason: message }).eq("id", intentRow.id);
    await admin.from("settlements").insert({
      intent_id: intentRow.id,
      plan_id: planRow.id,
      member_id: user.userId,
      rail: leg.rail,
      status: "failed",
      amount_cents: leg.amountCents,
      asset: leg.asset,
      receipt_json: { error: message } as unknown as Json,
    });
    return json({ error: message }, 502);
  }
}
