import { indexer } from "envio";

/**
 * Agora Instant Settlement Swap → AgoraSwap + PocketSettlement
 * for /api/receipts Activity chips.
 *
 * transaction.hash is enabled via field_selection in config.yaml.
 */
indexer.onEvent({ contract: "AgoraPair", event: "Swap" }, async ({ event, context }) => {
  try {
    const txHash = event.transaction.hash;
    const id = `${event.chainId}_${event.block.number}_${event.logIndex}`;
    const amount0Out = event.params.amount0Out;
    const amount1Out = event.params.amount1Out;
    const paid = amount0Out > 0n || amount1Out > 0n;
    const rawOut = amount1Out > 0n ? amount1Out : amount0Out;
    const amountCents = rawOut / 10_000n;
    const to = String(event.params.to);

    context.AgoraSwap.set({
      id,
      sender: String(event.params.sender),
      to,
      amount0In: event.params.amount0In,
      amount1In: event.params.amount1In,
      amount0Out,
      amount1Out,
      txHash,
    });

    context.PocketSettlement.set({
      id,
      memberId: to.toLowerCase(),
      status: paid ? "confirmed" : "info",
      amountCents,
      txHash,
      plainEnglish: paid ? "Payment settled on Monad testnet" : "Settlement observed",
      rail: "agora",
    });
  } catch (error) {
    context.log.error("Swap handler failed", {
      err: error instanceof Error ? error.message : String(error),
      block: event.block.number,
      logIndex: event.logIndex,
    });
    throw error;
  }
});
