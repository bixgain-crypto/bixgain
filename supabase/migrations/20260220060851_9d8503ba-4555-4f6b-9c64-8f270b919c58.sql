
-- Staking plans (admin-configurable)
CREATE TABLE public.staking_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  apy_rate NUMERIC NOT NULL DEFAULT 0,
  min_amount NUMERIC NOT NULL DEFAULT 100,
  max_amount NUMERIC DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  early_unstake_penalty NUMERIC NOT NULL DEFAULT 0.1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staking_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active staking plans"
  ON public.staking_plans FOR SELECT USING (true);

CREATE POLICY "Admins manage staking plans"
  ON public.staking_plans FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins update staking plans"
  ON public.staking_plans FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "Admins delete staking plans"
  ON public.staking_plans FOR DELETE USING (is_admin(auth.uid()));

-- User stakes
CREATE TABLE public.stakes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.staking_plans(id),
  amount NUMERIC NOT NULL,
  accrued_reward NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'unstaked')),
  staked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  matures_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  last_accrual_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own stakes"
  ON public.stakes FOR SELECT USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Users insert own stakes"
  ON public.stakes FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "System update stakes"
  ON public.stakes FOR UPDATE USING (user_id = auth.uid() OR is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_stakes_updated_at
  BEFORE UPDATE ON public.stakes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_staking_plans_updated_at
  BEFORE UPDATE ON public.staking_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Insert default staking plans
INSERT INTO public.staking_plans (name, duration_days, apy_rate, min_amount, max_amount, early_unstake_penalty) VALUES
  ('Flex 7', 7, 5, 50, 10000, 0.05),
  ('Standard 30', 30, 12, 100, 50000, 0.10),
  ('Pro 90', 90, 24, 500, 100000, 0.15),
  ('Diamond 180', 180, 36, 1000, NULL, 0.20);
