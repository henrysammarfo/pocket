/**
 * Optional Tenderly simulation before live send.
 * Requires TENDERLY_ACCESS_KEY + account/project. No mock simulation results.
 */

export async function simulateTransaction(tx: {
  from: string;
  to: string;
  data: string;
  value?: string;
}): Promise<{ success: boolean; gasUsed?: string; error?: string }> {
  const key = process.env["TENDERLY_ACCESS_KEY"];
  const account = process.env["TENDERLY_ACCOUNT"];
  const project = process.env["TENDERLY_PROJECT"];
  if (!key || !account || !project) {
    throw new Error("Tenderly not configured");
  }

  const res = await fetch(
    `https://api.tenderly.co/api/v1/account/${account}/project/${project}/simulate`,
    {
      method: "POST",
      headers: {
        "X-Access-Key": key,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        network_id: "10143",
        from: tx.from,
        to: tx.to,
        input: tx.data,
        value: tx.value ?? "0",
        save: false,
        save_if_fails: true,
      }),
    },
  );
  if (!res.ok) throw new Error(`Tenderly ${res.status}`);
  const body = (await res.json()) as {
    simulation?: { status?: boolean; gas_used?: number };
    error?: { message?: string };
  };
  const out: { success: boolean; gasUsed?: string; error?: string } = {
    success: Boolean(body.simulation?.status),
  };
  if (body.simulation?.gas_used != null) out.gasUsed = String(body.simulation.gas_used);
  if (body.error?.message) out.error = body.error.message;
  return out;
}
