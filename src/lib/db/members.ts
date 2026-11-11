import { eq } from "drizzle-orm";
import { getDb } from "./client";
import { householdMembers, households, members } from "../../../drizzle/schema";
import type { VerifiedPrivyUser } from "@/lib/auth/privy.server";

export type PocketMember = {
  id: string;
  householdId: string | null;
  privyUserId: string;
  walletAddress: string | null;
  email: string | null;
  displayName: string | null;
};

export async function findMemberByPrivyUserId(privyUserId: string): Promise<PocketMember | null> {
  const db = getDb();
  const rows = await db.select().from(members).where(eq(members.privyUserId, privyUserId)).limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    householdId: row.householdId,
    privyUserId: row.privyUserId,
    walletAddress: row.walletAddress,
    email: row.email,
    displayName: row.displayName,
  };
}

/** Ensure member + default household exist for a verified Privy identity. */
export async function ensureMemberForPrivy(privy: VerifiedPrivyUser): Promise<PocketMember> {
  const db = getDb();
  const existing = await findMemberByPrivyUserId(privy.userId);
  if (existing?.householdId) {
    const patch: Partial<typeof members.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (privy.walletAddress) patch.walletAddress = privy.walletAddress;
    if (privy.email) patch.email = privy.email;
    await db.update(members).set(patch).where(eq(members.id, existing.id));
    return {
      ...existing,
      walletAddress: privy.walletAddress ?? existing.walletAddress,
      email: privy.email ?? existing.email,
    };
  }

  if (existing && !existing.householdId) {
    const [hh] = await db
      .insert(households)
      .values({ name: "My household", createdBy: existing.id })
      .returning({ id: households.id });
    if (!hh) throw new Error("household create failed");
    await db
      .update(members)
      .set({
        householdId: hh.id,
        walletAddress: privy.walletAddress ?? existing.walletAddress,
        email: privy.email ?? existing.email,
        displayName: existing.displayName ?? privy.email?.split("@")[0] ?? "Member",
        updatedAt: new Date(),
      })
      .where(eq(members.id, existing.id));
    await db.insert(householdMembers).values({
      householdId: hh.id,
      memberId: existing.id,
      role: "owner",
    });
    return {
      id: existing.id,
      householdId: hh.id,
      privyUserId: privy.userId,
      walletAddress: privy.walletAddress ?? existing.walletAddress,
      email: privy.email ?? existing.email,
      displayName: existing.displayName,
    };
  }

  const [hh] = await db.insert(households).values({ name: "My household" }).returning({ id: households.id });
  if (!hh) throw new Error("household create failed");

  const [member] = await db
    .insert(members)
    .values({
      householdId: hh.id,
      privyUserId: privy.userId,
      walletAddress: privy.walletAddress ?? null,
      email: privy.email ?? null,
      displayName: privy.email?.split("@")[0] ?? "Member",
    })
    .returning();
  if (!member) throw new Error("member create failed");

  await db.update(households).set({ createdBy: member.id }).where(eq(households.id, hh.id));
  await db.insert(householdMembers).values({
    householdId: hh.id,
    memberId: member.id,
    role: "owner",
  });

  return {
    id: member.id,
    householdId: hh.id,
    privyUserId: member.privyUserId,
    walletAddress: member.walletAddress,
    email: member.email,
    displayName: member.displayName,
  };
}

/** Keep the member's stored EVM wallet in step with Privy. */
export async function setMemberWallet(memberId: string, walletAddress: string): Promise<void> {
  await getDb().update(members).set({ walletAddress, updatedAt: new Date() }).where(eq(members.id, memberId));
}
