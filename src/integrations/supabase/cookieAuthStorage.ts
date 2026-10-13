/**
 * Cookie-backed auth storage for production POCKET sessions.
 * Avoids localStorage for session tokens. Lovable preview frames still use the broker.
 *
 * Browser storage adapter talks to /api/auth/session which sets httpOnly cookies.
 */

const SESSION_COOKIE_KEY = "pocket-auth-token";

type StorageLike = {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  removeItem: (key: string) => void | Promise<void>;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

async function apiGet(key: string): Promise<string | null> {
  const res = await fetch(`/api/auth/session?key=${encodeURIComponent(key)}`, {
    credentials: "include",
    headers: { accept: "application/json" },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { value?: string | null };
  return typeof body.value === "string" ? body.value : null;
}

async function apiSet(key: string, value: string): Promise<void> {
  await fetch("/api/auth/session", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, value }),
  });
}

async function apiRemove(key: string): Promise<void> {
  await fetch(`/api/auth/session?key=${encodeURIComponent(key)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

/** Production cookie session storage (no localStorage). */
export function cookieAuthStorage(): StorageLike {
  if (!isBrowser()) {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }

  return {
    getItem: (key) => apiGet(key),
    setItem: (key, value) => apiSet(key, value),
    removeItem: (key) => apiRemove(key),
  };
}

export { SESSION_COOKIE_KEY };
