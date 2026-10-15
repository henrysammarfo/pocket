import { useEffect, useRef, useState } from "react";

type LinkState = { userId?: string; householdId?: string; walletAddress?: string };

/**
 * After Privy login, link identity to a Neon member + household row.
 * Uses dynamic import so the app boots when Privy provider is not configured.
 */
export function usePrivyLink() {
  const privyEnabled = Boolean(import.meta.env["VITE_PRIVY_APP_ID"]);
  const [ready, setReady] = useState(!privyEnabled);
  const [authenticated, setAuthenticated] = useState(false);
  const [link, setLink] = useState<LinkState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const once = useRef(false);

  useEffect(() => {
    if (!privyEnabled) return;
    let cancelled = false;
    (async () => {
      const mod = await import("@privy-io/react-auth");
      if (cancelled) return;
      // Poll Privy store via getAccessToken after login events — usePrivy must run in Privy tree.
      // This effect only runs under PrivyAppProvider when VITE_PRIVY_APP_ID is set.
      const { usePrivy } = mod;
      void usePrivy;
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [privyEnabled]);

  useEffect(() => {
    if (!privyEnabled || once.current) return;
    const onLinked = (ev: Event) => {
      const detail = (ev as CustomEvent<LinkState & { token?: string }>).detail;
      if (!detail?.token) return;
      once.current = true;
      setAuthenticated(true);
      void fetch("/api/auth/privy-link", {
        method: "POST",
        headers: { Authorization: `Bearer ${detail.token}`, "content-type": "application/json" },
      })
        .then(async (res) => {
          const body = (await res.json()) as LinkState & { error?: string; ok?: boolean };
          if (!res.ok) {
            setError(body.error ?? "Could not link Privy session");
            return;
          }
          const next: LinkState = {};
          if (body.userId) next.userId = body.userId;
          if (body.householdId) next.householdId = body.householdId;
          if (body.walletAddress) next.walletAddress = body.walletAddress;
          setLink(next);
        })
        .catch((e: unknown) => setError(e instanceof Error ? e.message : "Privy link failed"));
    };
    window.addEventListener("pocket:privy-linked", onLinked as EventListener);
    return () => window.removeEventListener("pocket:privy-linked", onLinked as EventListener);
  }, [privyEnabled]);

  return { privyEnabled, ready, authenticated, link, error };
}
