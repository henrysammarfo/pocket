-- Pocket on Otari: one row per Otari call, for the member's AI receipts.
CREATE TABLE IF NOT EXISTS "ai_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "member_id" uuid NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
  "thread_id" uuid REFERENCES "threads"("id") ON DELETE SET NULL,
  "role" text NOT NULL,
  "policy" text NOT NULL,
  "outcome" text NOT NULL,
  "receipt" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ai_requests_member_idx" ON "ai_requests" ("member_id", "created_at");
