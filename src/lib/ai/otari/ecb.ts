/**
 * Exchange rates come from the European Central Bank's public daily reference
 * rates, fetched by Otari's web fetch tool. The workspace's web fetch allowed
 * domains are set to ecb.europa.eu only, which Otari also applies to its
 * subdomains such as www.ecb.europa.eu (see OTARI.md).
 */
export const ECB_DAILY_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
export const ECB_HOST = "www.ecb.europa.eu";
/** The workspace allow rule. Otari matches a domain and its subdomains. */
export const ECB_DOMAIN = "ecb.europa.eu";

export type EcbRates = { date: string; perEur: Record<string, number> };

/** Parse the ECB daily XML (or the light text Otari extracts from it). */
export function parseEcbDaily(text: string): EcbRates | null {
  const date = text.match(/time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];
  const perEur: Record<string, number> = {};
  for (const m of text.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) {
    const rate = Number(m[2]);
    if (Number.isFinite(rate) && rate > 0) perEur[m[1]!] = rate;
  }
  if (!date || Object.keys(perEur).length === 0) return null;
  perEur["EUR"] = 1;
  return { date, perEur };
}

/** Convert between two currencies via EUR. Returns null for an unknown currency. */
export function convert(amount: number, from: string, to: string, rates: EcbRates): number | null {
  const f = rates.perEur[from.toUpperCase()];
  const t = rates.perEur[to.toUpperCase()];
  if (!f || !t) return null;
  return (amount / f) * t;
}

/** True when a fetch the model made was the ECB source Pocket allows. */
export function isEcbFetch(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === ECB_DOMAIN || u.hostname.endsWith(`.${ECB_DOMAIN}`));
  } catch {
    return false;
  }
}
