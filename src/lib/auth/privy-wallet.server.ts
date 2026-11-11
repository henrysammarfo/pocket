import { getPrivyNodeClient } from "./privy.server";
import { pickEvmWallet, type LinkedLike } from "./pick-wallet";

export type ResolvedPrivyWallet = {
  walletId: string;
  address: `0x${string}`;
};

/** Resolve the member's Privy embedded/smart wallet for server-side sponsored sends. */
export async function resolvePrivyWallet(privyUserId: string): Promise<ResolvedPrivyWallet | null> {
  const privy = getPrivyNodeClient();
  if (!privy) return null;
  try {
    const user = await privy.users()._get(privyUserId);
    const accounts = user.linked_accounts ?? [];
    const embedded = pickEvmWallet(accounts as unknown as LinkedLike[]);
    if (!embedded) return null;
    const address = String(embedded.address).trim() as `0x${string}`;
    const walletId =
      ("id" in embedded && embedded.id ? String(embedded.id) : null) ??
      ("wallet_id" in embedded && (embedded as { wallet_id?: string }).wallet_id
        ? String((embedded as { wallet_id?: string }).wallet_id)
        : null);
    if (!walletId) {
      // Fallback: list wallets for user via wallets API when linked account has no id.
      try {
        const listed = await privy.wallets().list({ user_id: privyUserId });
        const data = (listed as { data?: { id: string; address: string }[] }).data ?? [];
        const match = data.find((w) => w.address?.toLowerCase() === address.toLowerCase());
        if (!match?.id) return { walletId: "", address };
        return { walletId: match.id, address: (match.address as `0x${string}`) || address };
      } catch {
        return { walletId: "", address };
      }
    }
    return { walletId, address };
  } catch (e) {
    console.error("[privy-wallet] resolve failed", e);
    return null;
  }
}
