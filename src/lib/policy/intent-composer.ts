import type { ComposedIntent, MoneyPlan, SpendIntent } from "./types";
import { agoraAddresses } from "@/lib/monad/config";

/**
 * Compose atomic multi-leg settlement intents after PolicyEngine allow.
 */
export function composeIntent(intent: SpendIntent, plan: MoneyPlan): ComposedIntent {
  const amount = intent.amountCents ?? 0;
  const payee = intent.payeeAddress as `0x${string}` | undefined;

  if (intent.kind === "buy") {
    return {
      plainEnglish: `Put $${(amount / 100).toFixed(2)} to work inside the plan`,
      legs: [
        {
          rail: "kuru",
          amountCents: amount,
          asset: "AUSD",
          memo: `plan-buy:${plan.title}`,
        },
      ],
    };
  }

  return {
    plainEnglish: `Pay $${(amount / 100).toFixed(2)}${intent.payeeLabel ? ` to ${intent.payeeLabel}` : ""}`,
    legs: [
      {
        rail: "agora",
        amountCents: amount,
        asset: "AUSD",
        to: payee ?? agoraAddresses.ausd,
        memo: `plan-pay:${intent.payeeLabel ?? "payee"}`,
      },
    ],
  };
}
