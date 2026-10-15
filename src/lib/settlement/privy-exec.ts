import { encodeFunctionData, type Hex } from "viem";
import { MONAD_TESTNET_CHAIN_ID, monadTestnet } from "@/lib/monad/config";
import { getPrivyNodeClient, privyConfigured } from "@/lib/auth/privy.server";

export type UnsignedTx = {
  to: `0x${string}`;
  data: Hex;
  value?: bigint;
};

export type ExecResult = {
  txHash: `0x${string}`;
  explorerUrl: string;
};

/**
 * Send a sponsored transaction from the member's Privy embedded wallet on Monad testnet.
 * Requires Privy dashboard gas sponsorship enabled for Monad.
 */
export async function sendSponsoredTransaction(params: {
  walletId: string;
  tx: UnsignedTx;
}): Promise<ExecResult> {
  if (!privyConfigured()) {
    throw new Error("Privy is not configured");
  }
  const privy = getPrivyNodeClient();
  if (!privy) throw new Error("Privy client unavailable");

  const caip2 = `eip155:${MONAD_TESTNET_CHAIN_ID}` as const;
  const data = await privy.wallets().ethereum().sendTransaction(params.walletId, {
    caip2,
    sponsor: true,
    params: {
      transaction: {
        to: params.tx.to,
        data: params.tx.data,
        value: params.tx.value != null ? `0x${params.tx.value.toString(16)}` : "0x0",
        chain_id: MONAD_TESTNET_CHAIN_ID,
      },
    },
  });

  const txHash = (data.hash || (data as { transaction_hash?: string }).transaction_hash) as `0x${string}`;
  if (!txHash) throw new Error("Privy sendTransaction returned no hash");
  return {
    txHash,
    explorerUrl: `${monadTestnet.blockExplorers.default.url}/tx/${txHash}`,
  };
}

export function encodeApprove(token: `0x${string}`, spender: `0x${string}`, amount: bigint): UnsignedTx {
  return {
    to: token,
    data: encodeFunctionData({
      abi: [
        {
          type: "function",
          name: "approve",
          stateMutability: "nonpayable",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ type: "bool" }],
        },
      ] as const,
      functionName: "approve",
      args: [spender, amount],
    }),
  };
}
