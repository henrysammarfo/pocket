import { useCreateWallet, usePrivy } from "@privy-io/react-auth";
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * createOnLogin only fires at sign-up, so an account made before embedded
 * wallets were on never gets one. Create it once on the next sign-in.
 */
export function EnsureEmbeddedWallet() {
  const { ready, authenticated, user } = usePrivy();
  const { createWallet } = useCreateWallet();
  const qc = useQueryClient();
  const tried = useRef(false);
  useEffect(() => {
    if (!ready || !authenticated || !user || tried.current) return;
    const hasEmbedded = (user.linkedAccounts ?? []).some(
      (a) => a.type === "wallet" && "walletClientType" in a && (a as { walletClientType?: string }).walletClientType === "privy",
    );
    if (hasEmbedded) return;
    tried.current = true;
    createWallet()
      .then(() => qc.invalidateQueries())
      .catch((e: unknown) => console.warn("[privy] could not create embedded wallet", e));
  }, [ready, authenticated, user, createWallet, qc]);
  return null;
}
