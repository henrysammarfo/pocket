/**
 * Otari configuration. Every AI call in Pocket goes through Otari
 * (https://otari.ai), Mozilla.ai's open-source AI gateway.
 *
 * Model names here are Otari routing policy names, not provider models.
 * The policies (set up in the Otari dashboard, see OTARI.md) resolve to
 * open-weight models with fallbacks.
 */
export type OtariConfig = {
  baseUrl: string;
  serviceKey: string | null;
  guardKey: string | null;
  intentModel: string;
  explainModel: string;
  guardModel: string;
  /** Public origin of this app, used for the wallet MCP server URL. */
  publicOrigin: string | null;
  mcpSigningSecret: string | null;
};

type Env = Record<string, string | undefined>;

export function readOtariConfig(env: Env = process.env): OtariConfig {
  const baseUrl = (env["OTARI_BASE_URL"] || "https://api.otari.ai/api/v1").replace(/\/+$/, "");
  return {
    baseUrl,
    serviceKey: env["OTARI_SERVICE_KEY"] || null,
    guardKey: env["OTARI_GUARD_KEY"] || null,
    intentModel: env["OTARI_INTENT_MODEL"] || "pocket-intent",
    explainModel: env["OTARI_EXPLAIN_MODEL"] || "pocket-explain",
    guardModel: env["OTARI_GUARD_MODEL"] || "pocket-guard",
    publicOrigin: (env["POCKET_PUBLIC_ORIGIN"] || "").replace(/\/+$/, "") || null,
    mcpSigningSecret: env["POCKET_MCP_SIGNING_SECRET"] || null,
  };
}

/** Otari end-user id for a Pocket member. Stable, opaque, never an email. */
export function endUserId(memberId: string): string {
  return `pocket:${memberId}`;
}
