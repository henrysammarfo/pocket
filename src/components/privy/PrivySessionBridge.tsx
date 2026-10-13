import { usePrivy } from "@privy-io/react-auth";
import { useEffect } from "react";

/** Emits pocket:privy-linked when Privy auth is ready so members can be linked server-side. */
export function PrivySessionBridge() {
  const { ready, authenticated, getAccessToken, user } = usePrivy();

  useEffect(() => {
    if (!ready || !authenticated) return;
    void (async () => {
      const token = await getAccessToken();
      if (!token) return;
      window.dispatchEvent(
        new CustomEvent("pocket:privy-linked", {
          detail: {
            token,
            walletAddress: user?.wallet?.address,
          },
        }),
      );
    })();
  }, [ready, authenticated, getAccessToken, user?.wallet?.address]);

  return null;
}
