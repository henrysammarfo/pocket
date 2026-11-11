import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { members, moneyPlans, receipts } from "../../../drizzle/schema";
import { readAusdBalanceCents } from "@/lib/settlement/agora";
import type { WalletData } from "./server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Member ids are uuids; anything else is no member (Postgres would throw on the cast). */
export const isMemberId = (id: string) => UUID.test(id);

/** Live wallet data for the MCP server, always scoped to one member id. */
export const walletData: WalletData = {
  async getBalance(memberId) {
    if (!isMemberId(memberId)) return null;
    const db = getDb();
    const [m] = await db.select({ wallet: members.walletAddress }).from(members).where(eq(members.id, memberId)).limit(1);
    if (!m?.wallet) return null;
    const balanceCents = await readAusdBalanceCents(m.wallet as `0x${string}`);
    return { balanceCents, asset: "AUSD", network: "Monad testnet" };
  },
  async listActivity(memberId, limit) {
    if (!isMemberId(memberId)) return [];
    const rows = await getDb()
      .select({ text: receipts.plainEnglish, kind: receipts.kind, at: receipts.createdAt })
      .from(receipts)
      .where(eq(receipts.memberId, memberId))
      .orderBy(desc(receipts.createdAt))
      .limit(limit);
    return rows.map((r) => ({ text: r.text, kind: r.kind, at: r.at.toISOString() }));
  },
  async listPayees(memberId) {
    const plan = await approvedPlan(memberId);
    const list = (plan?.planJson as { allowlist?: { label: string; address?: string }[] } | undefined)?.allowlist ?? [];
    return list.map((p) => ({ label: p.label, ...(p.address ? { address: p.address } : {}) }));
  },
  async getPlan(memberId) {
    const plan = await approvedPlan(memberId);
    if (!plan) return null;
    const steps = ((plan.planJson as { steps?: { label: string; amountCents: number; when?: string }[] }).steps ?? []).map((s) => ({
      label: s.label,
      amountCents: s.amountCents,
      ...(s.when ? { when: s.when } : {}),
    }));
    return { title: plan.title, reserveFloorCents: plan.reserveFloorCents, steps };
  },
};

async function approvedPlan(memberId: string) {
  if (!isMemberId(memberId)) return null;
  const [row] = await getDb()
    .select({ title: moneyPlans.title, reserveFloorCents: moneyPlans.reserveFloorCents, planJson: moneyPlans.planJson })
    .from(moneyPlans)
    .where(and(eq(moneyPlans.memberId, memberId), eq(moneyPlans.status, "approved")))
    .orderBy(desc(moneyPlans.approvedAt))
    .limit(1);
  return row ?? null;
}
