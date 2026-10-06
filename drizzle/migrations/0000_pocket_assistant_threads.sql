CREATE TABLE public.threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT 'New money plan',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.threads TO authenticated;
GRANT ALL ON public.threads TO service_role;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own threads select" ON public.threads FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own threads insert" ON public.threads FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own threads update" ON public.threads FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own threads delete" ON public.threads FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  message_id text NOT NULL,
  role text NOT NULL,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (thread_id, message_id)
);
CREATE INDEX thread_messages_thread_idx ON public.thread_messages(thread_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.thread_messages TO authenticated;
GRANT ALL ON public.thread_messages TO service_role;
ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own messages select" ON public.thread_messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own messages insert" ON public.thread_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.threads t WHERE t.id = thread_id AND t.user_id = auth.uid()));
CREATE POLICY "Own messages update" ON public.thread_messages FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own messages delete" ON public.thread_messages FOR DELETE TO authenticated USING (auth.uid() = user_id);