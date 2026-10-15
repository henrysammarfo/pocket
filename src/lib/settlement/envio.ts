/**
 * Envio HyperIndex consumer — Activity receipts truth.
 * GraphQL URL from ENVIO_GRAPHQL_URL after indexer deploy.
 */

export type EnvioReceipt = {
  plainEnglish: string;
  kind: "paid" | "blocked" | "info";
  txHash?: string;
  entityId?: string;
};

const QUERY = `
  query PocketReceipts($memberId: String!) {
    PocketSettlement(where: { memberId: { _eq: $memberId } }, limit: 20, order_by: { id: desc }) {
      id
      status
      amountCents
      txHash
      plainEnglish
    }
  }
`;

export async function fetchEnvioReceipts(memberId: string): Promise<EnvioReceipt[]> {
  const url = process.env["ENVIO_GRAPHQL_URL"];
  const token = process.env["ENVIO_API_TOKEN"];
  if (!url) return [];

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query: QUERY, variables: { memberId } }),
  });
  if (!res.ok) throw new Error(`Envio GraphQL ${res.status}`);
  const body = (await res.json()) as {
    data?: { PocketSettlement?: { id: string; status: string; plainEnglish: string; txHash?: string }[] };
    errors?: { message: string }[];
  };
  if (body.errors?.length) throw new Error(body.errors[0]!.message);
  return (body.data?.PocketSettlement ?? []).map((r) => {
    const item: EnvioReceipt = {
      plainEnglish: r.plainEnglish,
      kind: r.status === "blocked" ? "blocked" : r.status === "confirmed" ? "paid" : "info",
      entityId: r.id,
    };
    if (r.txHash) item.txHash = r.txHash;
    return item;
  });
}
