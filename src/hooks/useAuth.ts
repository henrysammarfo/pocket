import { usePrivySession } from "@/components/privy/PrivySessionContext";

export type PocketUser = {
  id: string;
  email?: string;
};

export type PocketSession = {
  user: PocketUser;
  accessToken: string | null;
};

/** Privy-primary session for the signed-in product. */
export function useAuth() {
  const privy = usePrivySession();
  const loading = !privy.ready;
  const session: PocketSession | null =
    privy.authenticated && privy.userId
      ? {
          user: {
            id: privy.userId,
            ...(privy.email ? { email: privy.email } : {}),
          },
          accessToken: privy.accessToken,
        }
      : null;

  return {
    session,
    user: session?.user ?? null,
    loading,
    logout: privy.logout,
    getAccessToken: privy.getAccessToken,
  };
}

export async function authHeader(): Promise<Record<string, string>> {
  // Prefer live Privy token from the session bridge when available.
  try {
    const { getAccessToken } = await import("@privy-io/react-auth");
    void getAccessToken;
  } catch {
    /* ignore */
  }
  const token = await readCachedPrivyToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readCachedPrivyToken(): Promise<string | null> {
  // Module-level cache filled by PrivySessionBridge via custom event for non-hook callers.
  if (cachedToken && cachedTokenExpires > Date.now()) return cachedToken;
  return cachedToken;
}

let cachedToken: string | null = null;
let cachedTokenExpires = 0;

if (typeof window !== "undefined") {
  window.addEventListener("pocket:privy-linked", ((ev: CustomEvent<{ token?: string }>) => {
    if (ev.detail?.token) {
      cachedToken = ev.detail.token;
      cachedTokenExpires = Date.now() + 1000 * 60 * 30;
    }
  }) as EventListener);
}
