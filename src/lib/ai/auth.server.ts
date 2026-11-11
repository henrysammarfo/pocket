import { verifyPrivyAccessToken } from "@/lib/auth/privy.server";
import { ensureMemberForPrivy, findMemberByPrivyUserId, setMemberWallet, type PocketMember } from "@/lib/db/members";

export type AuthContext = {
  member: PocketMember;
  userId: string;
  privyUserId: string;
};

/** Authenticate API requests via Privy bearer token; resolve Neon member row. */
export async function authenticate(request: Request): Promise<AuthContext | null> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")?.trim();
  if (!token) return null;

  const privy = await verifyPrivyAccessToken(token);
  if (!privy) return null;

  let member = await findMemberByPrivyUserId(privy.userId).catch(() => null);
  if (!member) {
    try {
      member = await ensureMemberForPrivy(privy);
    } catch (e) {
      console.error("[auth] ensure member failed", e);
      return null;
    }
  } else if (privy.walletAddress && privy.walletAddress.toLowerCase() !== (member.walletAddress ?? "").toLowerCase()) {
    // Existing members never went through ensureMemberForPrivy again, so a
    // wallet created after sign-up (or a non-EVM one stored earlier) stayed
    // wrong in the db, and the wallet MCP the chat reads from saw no wallet.
    await setMemberWallet(member.id, privy.walletAddress).catch((e) => console.error("[auth] wallet sync failed", e));
    member = { ...member, walletAddress: privy.walletAddress };
  }

  return {
    member,
    userId: member.id,
    privyUserId: privy.userId,
  };
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
