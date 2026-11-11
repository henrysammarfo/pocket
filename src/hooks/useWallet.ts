import { useQuery } from "@tanstack/react-query";
import { authHeader } from "@/hooks/useAuth";

export type WalletPayload = {
  address: string | null;
  shortAddress: string | null;
  walletId: string | null;
  balanceCents: number;
  balanceUsd: string;
  chainId: number;
  asset: string;
  network: string;
  plan: { id: string; status: string; reserveFloorCents: number } | null;
  balanceError: string | null;
  email: string | null;
};

/**
 * Preview mode (?ui=1) only: a labelled example member for design review and
 * demos without signing in. Matches "Preview member" in app.tsx. Not a real
 * person, not a real wallet; no network call is made.
 */
export const PREVIEW_WALLET: WalletPayload = {
  address: "0x5EED000000000000000000000000000000000001",
  shortAddress: "0x5E…001",
  walletId: "preview",
  balanceCents: 124_000,
  balanceUsd: "1240.00",
  chainId: 10143,
  asset: "AUSD",
  network: "Monad testnet",
  plan: { id: "preview-plan", status: "approved", reserveFloorCents: 50_000 },
  balanceError: null,
  email: "preview@example.com",
};

export const isPreviewUi = () =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).get("ui") === "1";

export function useWallet() {
  return useQuery({
    queryKey: ["wallet"],
    queryFn: async (): Promise<WalletPayload> => {
      if (isPreviewUi()) return PREVIEW_WALLET;
      const res = await fetch("/api/wallet", { headers: await authHeader() });
      const body = (await res.json()) as WalletPayload & { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? "Could not load wallet");
      }
      return body;
    },
    staleTime: 15_000,
    retry: 1,
  });
}
