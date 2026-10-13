/**
 * Envio event handlers — generated types appear after `envio codegen`.
 * This file is written to compile against Envio's handler API once scaffolded.
 */
import { AgoraPair } from "../generated/src/Handlers.gen";

AgoraPair.Swap.handler(async ({ event, context }) => {
  const id = `${event.transactionHash}-${event.logIndex}`;
  context.AgoraSwap.set({
    id,
    sender: event.params.sender,
    to: event.params.to,
    amount0In: event.params.amount0In,
    amount1In: event.params.amount1In,
    amount0Out: event.params.amount0Out,
    amount1Out: event.params.amount1Out,
    txHash: event.transactionHash,
  });

  // Plain-English Activity chip — Envio drives a core product feature.
  const paid = event.params.amount0Out > 0n || event.params.amount1Out > 0n;
  context.PocketSettlement.set({
    id,
    memberId: event.params.to.toLowerCase(),
    status: paid ? "confirmed" : "info",
    amountCents: event.params.amount1Out > 0n ? event.params.amount1Out / 10n ** 4n : event.params.amount0Out / 10n ** 4n,
    txHash: event.transactionHash,
    plainEnglish: paid ? "Payment settled on Monad testnet" : "Settlement observed",
    rail: "agora",
  });
});
