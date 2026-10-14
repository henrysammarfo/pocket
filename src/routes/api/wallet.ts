import { createFileRoute } from "@tanstack/react-router";
import { and, desc, eq } from "drizzle-orm";
import { authenticate, json } from "@/lib/ai/auth.server";
import { getDb } from "@/lib/db/client";
import { moneyPlans } from "../../../drizzle/schema";
import { resolvePrivyWallet } from "@/lib/auth/privy-wallet.server";
import { readAusdBalanceCents } from "@/lib/settlement/agora";

function shortAddr(addr: string) {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-3)}`;
}

/** Live wallet: Privy address + AUSD balance on Monad testnet + plan status. */
export const Route = createFileRoute("/api/wallet")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if (!auth) return json({ error: "Please sign in again." }, 401);

        let address =
          (auth.member.walletAddress as `0x${string}` | null) ??
          null;
        let walletId: string | null = null;

        const resolved = await resolvePrivyWallet(auth.privyUserId).catch(() => null);
        if (resolved) {
          address = resolved.address;
          walletId = resolved.walletId;
        }

        let balanceCents = 0;
        let balanceError: string | null = null;
        if (address) {
          try {
            balanceCents = await readAusdBalanceCents(address);
          } catch (e) {
            balanceError = e instanceof Error ? e.message : "Balance read failed";
            console.error("[wallet] balance", e);
          }
        }

        let plan: { id: string; status: string; reserveFloorCents: number } | null = null;
        try {
          const db = getDb();
          const [row] = await db
            .select({
              id: moneyPlans.id,
              status: moneyPlans.status,
              reserveFloorCents: moneyPlans.reserveFloorCents,
            })
            .from(moneyPlans)
            .where(and(eq(moneyPlans.memberId, auth.userId), eq(moneyPlans.status, "approved")))
            .orderBy(desc(moneyPlans.approvedAt))
            .limit(1);
          if (row) plan = row;
        } catch {
          /* plan optional when DB flaky */
        }

        return json({
          address,
          shortAddress: address ? shortAddr(address) : null,
          walletId,
          balanceCents,
          balanceUsd: (balanceCents / 100).toFixed(2),
          chainId: 10143,
          asset: "AUSD",
          network: "Monad testnet",
          plan,
          balanceError,
          email: auth.member.email ?? null,
        });
      },
    },
  },
});
