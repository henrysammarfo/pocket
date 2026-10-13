/**
 * Optional Nansen under-hood risk hints for chat.
 * Dropped when NANSEN_API_KEY unset — never fabricates smart-money data.
 */

export type NansenHint = { summary: string; source: "nansen" };

export async function fetchWalletRiskHint(address: string): Promise<NansenHint | null> {
  const key = process.env["NANSEN_API_KEY"];
  if (!key) return null;

  const res = await fetch("https://api.nansen.ai/v1/tgm/address", {
    method: "POST",
    headers: {
      apikey: key,
      "content-type": "application/json",
    },
    body: JSON.stringify({ address, chain: "monad" }),
  });
  if (!res.ok) {
    throw new Error(`Nansen API ${res.status}`);
  }
  const body = (await res.json()) as { label?: string; summary?: string };
  return {
    summary: body.summary || body.label || "Nansen signal available",
    source: "nansen",
  };
}
