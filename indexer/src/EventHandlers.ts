import { indexer } from "envio";

/**
 * Agora Instant Settlement Swap → AgoraSwap + PocketSettlement entities
 * for /api/receipts Activity chips.
 */
indexer.onEvent(
  {
    contract: "AgoraPair",
    event: "Swap",
    fields: { transaction: ["hash"] },
  },
  async ({ event, context }) => {
    const txHash = event.transaction.hash;
    const id = `${txHash}-${event.logIndex}`;
    const paid = event.params.amount0Out > 0n || event.params.amount1Out > 0n;
    const rawOut = event.params.amount1Out > 0n ? event.params.amount1Out : event.params.amount0Out;
    // AUSD is 6 decimals on testnet; store rough cents (÷ 10^4).
    const amountCents = rawOut / 10_000n;

    context.AgoraSwap.set({
      id,
      sender: event.params.sender,
      to: event.params.to,
      amount0In: event.params.amount0In,
      amount1In: event.params.amount1In,
      amount0Out: event.params.amount0Out,
      amount1Out: event.params.amount1Out,
      txHash,
    });

    context.PocketSettlement.set({
      id,
      memberId: event.params.to.toLowerCase(),
      status: paid ? "confirmed" : "info",
      amountCents,
      txHash,
      plainEnglish: paid ? "Payment settled on Monad testnet" : "Settlement observed",
      rail: "agora",
    });
  },
);
