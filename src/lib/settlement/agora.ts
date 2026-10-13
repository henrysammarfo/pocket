import { createPublicClient, encodeFunctionData, http, parseUnits } from "viem";
import { agoraAddresses, monadTestnet } from "@/lib/monad/config";
import { erc20Abi, instantSettlementPairAbi } from "./abis";
import { encodeApprove, sendSponsoredTransaction, type ExecResult } from "./privy-exec";

export type AgoraPayParams = {
  walletId: string;
  fromAddress: `0x${string}`;
  /** Amount in USD cents (AUSD 6 decimals on testnet). */
  amountCents: number;
  /** Recipient of swap output / transfer. */
  to: `0x${string}`;
  /** Token in path[0] — defaults to AUSD for transfer-style pays. */
  mode?: "transfer" | "swap";
};

function publicClient() {
  return createPublicClient({
    chain: monadTestnet,
    transport: http(monadTestnet.rpcUrls.default.http[0]),
  });
}

/** Convert cents to AUSD base units (6 decimals). */
export function ausdFromCents(cents: number): bigint {
  return parseUnits((cents / 100).toFixed(2), 6);
}

/**
 * Live Agora Instant Settlement / AUSD pay on Monad testnet.
 * Prefer ERC20 transfer of AUSD for consumer pays; swap path available for CTK↔AUSD.
 */
export async function executeAgoraPay(params: AgoraPayParams): Promise<ExecResult> {
  const client = publicClient();
  const amount = ausdFromCents(params.amountCents);

  const balance = await client.readContract({
    address: agoraAddresses.ausd,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [params.fromAddress],
  });
  if (balance < amount) {
    throw new Error(`Insufficient AUSD balance for pay (have ${balance}, need ${amount})`);
  }

  if (params.mode === "swap") {
    const pair = agoraAddresses.ctkAusdPair;
    const path = [agoraAddresses.ausd, agoraAddresses.ausd] as [`0x${string}`, `0x${string}`];
    // Approve pair
    await sendSponsoredTransaction({
      walletId: params.walletId,
      tx: encodeApprove(agoraAddresses.ausd, pair, amount),
    });
    const amounts = await client.readContract({
      address: pair,
      abi: instantSettlementPairAbi,
      functionName: "getAmountsOut",
      args: [amount, [...path]],
    });
    const amountOutMin = (amounts as bigint[])[1] ?? 0n;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
    const data = encodeFunctionData({
      abi: instantSettlementPairAbi,
      functionName: "swapExactTokensForTokens",
      args: [amount, amountOutMin, [...path], params.to, deadline],
    });
    return sendSponsoredTransaction({
      walletId: params.walletId,
      tx: { to: pair, data },
    });
  }

  // Consumer default: AUSD transfer to allowlisted payee
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [params.to, amount],
  });
  return sendSponsoredTransaction({
    walletId: params.walletId,
    tx: { to: agoraAddresses.ausd, data },
  });
}

export async function readAusdBalanceCents(address: `0x${string}`): Promise<number> {
  const client = publicClient();
  const bal = await client.readContract({
    address: agoraAddresses.ausd,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address],
  });
  return Number(bal) / 1e4; // 6 decimals → cents: /1e4
}
