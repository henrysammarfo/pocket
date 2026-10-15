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

const PREVIEW_WALLET: WalletPayload = {
  address: "0xAbC1234567890defAbC1234567890defAbC178c",
  shortAddress: "0xAb…78c",
  walletId: "preview",
  balanceCents: 800000,
  balanceUsd: "8000.00",
  chainId: 10143,
  asset: "AUSD",
  network: "Monad testnet",
  plan: null,
  balanceError: null,
  email: "davidlloyd@gmail.com",
};

export function useWallet() {
  return useQuery({
    queryKey: ["wallet"],
    queryFn: async (): Promise<WalletPayload> => {
      const preview =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("ui") === "1";
      const res = await fetch("/api/wallet", { headers: await authHeader() });
      const body = (await res.json()) as WalletPayload & { error?: string };
      if (!res.ok) {
        if (preview) return PREVIEW_WALLET;
        throw new Error(body.error ?? "Could not load wallet");
      }
      return body;
    },
    staleTime: 15_000,
    retry: 1,
  });
}
