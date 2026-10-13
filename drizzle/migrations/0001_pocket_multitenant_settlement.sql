-- POCKET multi-tenant members + fail-closed money plans + settlements

CREATE TABLE IF NOT EXISTS public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My household',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.members (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id uuid REFERENCES public.households(id) ON DELETE SET NULL,
  privy_user_id text UNIQUE,
  wallet_address text,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.household_members (
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (household_id, member_id)
);

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

CREATE TABLE IF NOT EXISTS public.plan_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.money_plans(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('reserve_floor', 'allowlist_payee', 'spending_cap', 'expiry', 'custom')),
  label text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  pinned boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE INDEX IF NOT EXISTS money_plans_member_idx ON public.money_plans(member_id, status);
CREATE INDEX IF NOT EXISTS plan_rules_plan_idx ON public.plan_rules(plan_id);
CREATE INDEX IF NOT EXISTS intents_plan_idx ON public.intents(plan_id, created_at);
CREATE INDEX IF NOT EXISTS settlements_member_idx ON public.settlements(member_id, created_at);
CREATE INDEX IF NOT EXISTS receipts_household_idx ON public.receipts(household_id, created_at DESC);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.money_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_household_member(hh uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = hh AND hm.member_id = auth.uid()
  );
$$;

CREATE POLICY "households select" ON public.households FOR SELECT TO authenticated
  USING (public.is_household_member(id) OR created_by = auth.uid());
CREATE POLICY "households insert" ON public.households FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "members select self" ON public.members FOR SELECT TO authenticated
  USING (id = auth.uid() OR (household_id IS NOT NULL AND public.is_household_member(household_id)));
CREATE POLICY "members upsert self" ON public.members FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "members update self" ON public.members FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "hh members select" ON public.household_members FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));
CREATE POLICY "hh members insert" ON public.household_members FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid() OR public.is_household_member(household_id));

CREATE POLICY "plans select" ON public.money_plans FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));
CREATE POLICY "plans insert" ON public.money_plans FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid() AND public.is_household_member(household_id));
CREATE POLICY "plans update" ON public.money_plans FOR UPDATE TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY "rules select" ON public.plan_rules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.money_plans p WHERE p.id = plan_id AND public.is_household_member(p.household_id)));
CREATE POLICY "rules insert" ON public.plan_rules FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.money_plans p WHERE p.id = plan_id AND p.member_id = auth.uid()));

CREATE POLICY "intents select" ON public.intents FOR SELECT TO authenticated
  USING (member_id = auth.uid());
CREATE POLICY "intents insert" ON public.intents FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "settlements select" ON public.settlements FOR SELECT TO authenticated
  USING (member_id = auth.uid());
CREATE POLICY "settlements insert" ON public.settlements FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid());

CREATE POLICY "receipts select" ON public.receipts FOR SELECT TO authenticated
  USING (public.is_household_member(household_id));
CREATE POLICY "receipts insert" ON public.receipts FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.households TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.household_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.money_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.intents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settlements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receipts TO authenticated;
GRANT ALL ON public.households TO service_role;
GRANT ALL ON public.members TO service_role;
GRANT ALL ON public.household_members TO service_role;
GRANT ALL ON public.money_plans TO service_role;
GRANT ALL ON public.plan_rules TO service_role;
GRANT ALL ON public.intents TO service_role;
GRANT ALL ON public.settlements TO service_role;
GRANT ALL ON public.receipts TO service_role;
