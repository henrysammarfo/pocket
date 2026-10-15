/**
 * Optional Kuru leg for "put rest to work" — only invoked after PolicyEngine allow.
 * Never surfaced as a trading UI.
 *
 * Live place-order path requires Kuru SDK + market addresses on Monad testnet.
 * When `KURU_MARKET_ADDRESS` is unset, this module refuses rather than faking a fill.
 */

import { encodeFunctionData } from "viem";
import { sendSponsoredTransaction, type ExecResult } from "./privy-exec";

export type KuruAllocateParams = {
  walletId: string;
  amountCents: number;
  fromAddress: `0x${string}`;
};

export async function executeKuruAllocate(params: KuruAllocateParams): Promise<ExecResult> {
  const market = process.env["KURU_MARKET_ADDRESS"] as `0x${string}` | undefined;
  const router = process.env["KURU_ROUTER_ADDRESS"] as `0x${string}` | undefined;
  if (!market || !router) {
    throw new Error(
      "Kuru testnet market/router not configured (KURU_MARKET_ADDRESS, KURU_ROUTER_ADDRESS). Feature dropped until testnet addresses are set.",
    );
  }

  // Placeholder calldata shape — replace with @kuru-labs/kuru-sdk encode once market IDs are wired.
  const data = encodeFunctionData({
    abi: [
      {
        type: "function",
        name: "deposit",
        stateMutability: "nonpayable",
        inputs: [
          { name: "market", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [],
      },
    ] as const,
    functionName: "deposit",
    args: [market, BigInt(params.amountCents) * 10n ** 4n],
  });

  void params.fromAddress;
  return sendSponsoredTransaction({
    walletId: params.walletId,
    tx: { to: router, data },
  });
}
