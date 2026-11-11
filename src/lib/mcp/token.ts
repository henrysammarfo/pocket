import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Short-lived, member-scoped bearer token for the wallet MCP server.
 * Pocket mints one per chat request and hands it to Otari inline as the MCP
 * server's authorization_token, so a tool call can only ever read the member
 * who is chatting. Format: v1.<memberId b64url>.<expiry unix s>.<hmac b64url>
 */
const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");

export function signMcpToken(memberId: string, secret: string, ttlSec = 300, now = Date.now()): string {
  if (!secret || secret.length < 32) throw new Error("POCKET_MCP_SIGNING_SECRET must be at least 32 characters");
  const exp = Math.floor(now / 1000) + ttlSec;
  const payload = `v1.${b64(memberId)}.${exp}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export type TokenCheck = { ok: true; memberId: string } | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyMcpToken(token: string, secret: string, now = Date.now()): TokenCheck {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return { ok: false, reason: "malformed" };
  const [, idPart, expPart, sig] = parts as [string, string, string, string];
  const payload = `v1.${idPart}.${expPart}`;
  const want = createHmac("sha256", secret).update(payload).digest();
  let got: Buffer;
  try {
    got = Buffer.from(sig, "base64url");
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (got.length !== want.length || !timingSafeEqual(got, want)) return { ok: false, reason: "bad_signature" };
  const exp = Number(expPart);
  if (!Number.isInteger(exp) || exp * 1000 < now) return { ok: false, reason: "expired" };
  const memberId = Buffer.from(idPart, "base64url").toString("utf8");
  if (!memberId) return { ok: false, reason: "malformed" };
  return { ok: true, memberId };
}
