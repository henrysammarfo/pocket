import { getDb } from "@/lib/db/client";
import { aiRequests } from "../../../../drizzle/schema";
import type { AiReceipt } from "./receipt";

/** Best effort: an audit write must never break a chat or a payment. */
export async function recordAiRequest(row: {
  memberId: string;
  threadId?: string | null;
  role: AiReceipt["role"] | "guard";
  policy: string;
  outcome: string;
  receipt: AiReceipt | Record<string, unknown>;
}): Promise<void> {
  try {
    await getDb()
      .insert(aiRequests)
      .values({
        memberId: row.memberId,
        threadId: row.threadId ?? null,
        role: row.role,
        policy: row.policy,
        outcome: row.outcome,
        receipt: row.receipt as Record<string, unknown>,
      });
  } catch (e) {
    console.error("[ai] could not record request", e instanceof Error ? e.message : e);
  }
}
