import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PrivySessionContext } from "./PrivySessionContext";

/** Keeps Privy access token in React context and notifies member-link listeners. */
export function PrivySessionBridge({ children }: { children: ReactNode }) {
  const { ready, authenticated, getAccessToken, user, logout } = usePrivy();
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !authenticated) {
      setAccessToken(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const token = await getAccessToken();
      if (cancelled) return;
      setAccessToken(token);
      if (!token) return;
      window.dispatchEvent(
        new CustomEvent("pocket:privy-linked", {
          detail: {
            token,
            userId: user?.id,
            email: user?.email?.address,
            walletAddress: user?.wallet?.address,
          },
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken, user?.id, user?.email?.address, user?.wallet?.address]);

  const value = useMemo(
    () => ({
      ready,
      authenticated,
      userId: user?.id ?? null,
      email: user?.email?.address ?? null,
      accessToken,
      logout: async () => {
        await logout();
        setAccessToken(null);
      },
      getAccessToken: async () => {
        const token = await getAccessToken();
        setAccessToken(token);
        return token;
      },
    }),
    [ready, authenticated, user?.id, user?.email?.address, accessToken, logout, getAccessToken],
  );

  return <PrivySessionContext.Provider value={value}>{children}</PrivySessionContext.Provider>;
}
