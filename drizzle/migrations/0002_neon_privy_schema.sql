-- POCKET on Neon Postgres — Privy identity, app-enforced access (app-enforced access, no row level security)

CREATE TABLE IF NOT EXISTS public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My household',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES public.households(id) ON DELETE SET NULL,
  privy_user_id text NOT NULL,
  wallet_address text,
  display_name text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS members_privy_user_id_uidx ON public.members(privy_user_id);

CREATE TABLE IF NOT EXISTS public.household_members (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, member_id)
);

CREATE TABLE IF NOT EXISTS public.threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New money plan',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS threads_member_idx ON public.threads(member_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  message_id text NOT NULL,
  role text NOT NULL,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS thread_messages_thread_message_uidx ON public.thread_messages(thread_id, message_id);
CREATE INDEX IF NOT EXISTS thread_messages_thread_idx ON public.thread_messages(thread_id, created_at);

CREATE TABLE IF NOT EXISTS public.money_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.threads(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT 'Money plan',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'expired', 'revoked')),
  currency text NOT NULL DEFAULT 'USD',
  reserve_floor_cents bigint NOT NULL DEFAULT 20000,
  spending_cap_cents bigint,
  expires_at timestamptz,
  approved_at timestamptz,
  plan_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS money_plans_member_idx ON public.money_plans(member_id, status);

CREATE TABLE IF NOT EXISTS public.plan_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.money_plans(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('reserve_floor', 'allowlist_payee', 'spending_cap', 'expiry', 'custom')),
  label text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  pinned boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plan_rules_plan_idx ON public.plan_rules(plan_id);

CREATE TABLE IF NOT EXISTS public.intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.money_plans(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'typed' CHECK (source IN ('typed', 'spoken', 'system')),
  raw_text text NOT NULL,
  parsed jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'allowed', 'blocked', 'executed', 'failed')),
  deny_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS intents_plan_idx ON public.intents(plan_id, created_at);

CREATE TABLE IF NOT EXISTS public.settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid NOT NULL REFERENCES public.intents(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.money_plans(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  rail text NOT NULL DEFAULT 'agora' CHECK (rail IN ('agora', 'kuru', 'transfer', 'blocked')),
  status text NOT NULL CHECK (status IN ('blocked', 'submitted', 'confirmed', 'failed')),
  amount_cents bigint NOT NULL DEFAULT 0,
  asset text NOT NULL DEFAULT 'AUSD',
  tx_hash text,
  explorer_url text,
  receipt_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS settlements_member_idx ON public.settlements(member_id, created_at);

CREATE TABLE IF NOT EXISTS public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id uuid REFERENCES public.settlements(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  plain_english text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('paid', 'blocked', 'info')),
  envio_entity_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS receipts_household_idx ON public.receipts(household_id, created_at DESC);
