import { createFileRoute } from "@tanstack/react-router";

const MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const COOKIE_PREFIX = "pk_sb_";

function cookieName(key: string): string {
  return `${COOKIE_PREFIX}${encodeURIComponent(key).replace(/%/g, "_")}`;
}

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function setCookieHeader(name: string, value: string, maxAge = MAX_AGE): string {
  const secure = process.env["NODE_ENV"] === "production" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function clearCookieHeader(name: string): string {
  return `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export const Route = createFileRoute("/api/auth/session")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const key = url.searchParams.get("key");
        if (!key) return Response.json({ error: "key required" }, { status: 400 });
        const cookies = parseCookies(request.headers.get("cookie"));
        const value = cookies[cookieName(key)] ?? null;
        return Response.json({ value });
      },
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as { key?: string; value?: string } | null;
        if (!body?.key || typeof body.value !== "string") {
          return Response.json({ error: "key and value required" }, { status: 400 });
        }
        if (body.value.length > 200_000) {
          return Response.json({ error: "session too large" }, { status: 413 });
        }
        const name = cookieName(body.key);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "set-cookie": setCookieHeader(name, body.value),
          },
        });
      },
      DELETE: async ({ request }) => {
        const url = new URL(request.url);
        const key = url.searchParams.get("key");
        if (!key) return Response.json({ error: "key required" }, { status: 400 });
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "set-cookie": clearCookieHeader(cookieName(key)),
          },
        });
      },
    },
  },
});
