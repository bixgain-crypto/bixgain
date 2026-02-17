
-- =============================================
-- 1. Extend tasks table with verification fields
-- =============================================
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS target_url text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS required_seconds integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS verification_rules jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS max_attempts integer DEFAULT 1;

-- =============================================
-- 2. Create task_attempts table
-- =============================================
CREATE TABLE public.task_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'pending', 'approved', 'rejected')),
  proof_url text,
  proof_text text,
  visit_token text,
  watch_seconds integer DEFAULT 0,
  ip_address text,
  device_id text,
  suspicious boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid
);

CREATE INDEX idx_task_attempts_user ON public.task_attempts(user_id);
CREATE INDEX idx_task_attempts_task ON public.task_attempts(task_id);
CREATE INDEX idx_task_attempts_status ON public.task_attempts(status);
CREATE INDEX idx_task_attempts_visit_token ON public.task_attempts(visit_token);

ALTER TABLE public.task_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own attempts"
  ON public.task_attempts FOR SELECT
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Users insert own attempts"
  ON public.task_attempts FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own started attempts"
  ON public.task_attempts FOR UPDATE
  USING ((user_id = auth.uid() AND status = 'started') OR is_admin(auth.uid()));

-- =============================================
-- 3. Create referrals table
-- =============================================
CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL,
  referred_id uuid NOT NULL,
  qualified boolean NOT NULL DEFAULT false,
  qualified_at timestamptz,
  referrer_ip text,
  referred_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referrer_id, referred_id)
);

CREATE INDEX idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_referred ON public.referrals(referred_id);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own referrals"
  ON public.referrals FOR SELECT
  USING (referrer_id = auth.uid() OR referred_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "System insert referrals"
  ON public.referrals FOR INSERT
  WITH CHECK (referred_id = auth.uid() OR is_admin(auth.uid()));

CREATE POLICY "Admins update referrals"
  ON public.referrals FOR UPDATE
  USING (is_admin(auth.uid()));

-- =============================================
-- 4. Create reward_ledger table
-- =============================================
CREATE TABLE public.reward_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  reason text NOT NULL,
  reference_id uuid,
  reference_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reward_ledger_user ON public.reward_ledger(user_id);
CREATE INDEX idx_reward_ledger_created ON public.reward_ledger(created_at);

ALTER TABLE public.reward_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ledger"
  ON public.reward_ledger FOR SELECT
  USING (user_id = auth.uid() OR is_admin(auth.uid()));

-- Only server (admin/edge functions) can insert rewards
CREATE POLICY "Admins insert ledger"
  ON public.reward_ledger FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

-- =============================================
-- 5. Create storage bucket for proof screenshots
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-proofs', 'task-proofs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'task-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users view own proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'task-proofs' AND (auth.uid()::text = (storage.foldername(name))[1] OR is_admin(auth.uid())));

CREATE POLICY "Admins view all proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'task-proofs' AND is_admin(auth.uid()));

-- =============================================
-- 6. Auto-assign admin to bixgain@gmail.com
-- =============================================
-- Ensure super_admin role exists
INSERT INTO public.admin_roles (id, name, description)
VALUES (gen_random_uuid(), 'super_admin', 'Full platform access')
ON CONFLICT DO NOTHING;

-- Create trigger to auto-assign admin on signup for bixgain@gmail.com
CREATE OR REPLACE FUNCTION public.auto_assign_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _role_id uuid;
BEGIN
  IF NEW.email = 'bixgain@gmail.com' THEN
    SELECT id INTO _role_id FROM public.admin_roles WHERE name = 'super_admin' LIMIT 1;
    IF _role_id IS NOT NULL THEN
      INSERT INTO public.admin_users (user_id, role_id, is_active)
      VALUES (NEW.id, _role_id, true)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_auto_assign_admin
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_admin();

-- Also assign if bixgain@gmail.com already exists
DO $$
DECLARE
  _user_id uuid;
  _role_id uuid;
BEGIN
  SELECT id INTO _user_id FROM auth.users WHERE email = 'bixgain@gmail.com' LIMIT 1;
  IF _user_id IS NOT NULL THEN
    SELECT id INTO _role_id FROM public.admin_roles WHERE name = 'super_admin' LIMIT 1;
    IF _role_id IS NOT NULL THEN
      INSERT INTO public.admin_users (user_id, role_id, is_active)
      VALUES (_user_id, _role_id, true)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END;
$$;

-- Add full permissions for super_admin
DO $$
DECLARE
  _role_id uuid;
BEGIN
  SELECT id INTO _role_id FROM public.admin_roles WHERE name = 'super_admin' LIMIT 1;
  IF _role_id IS NOT NULL THEN
    INSERT INTO public.admin_permissions (role_id, permission_key)
    VALUES
      (_role_id, 'manage_tasks'),
      (_role_id, 'manage_users'),
      (_role_id, 'manage_claims'),
      (_role_id, 'manage_rewards'),
      (_role_id, 'manage_fraud'),
      (_role_id, 'manage_settings'),
      (_role_id, 'view_audit_log'),
      (_role_id, 'manage_roles')
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- Update sample tasks with verification fields
UPDATE public.tasks SET target_url = 'https://twitter.com/bixgain', verification_rules = '{"type":"social_follow","platform":"twitter"}'::jsonb WHERE name ILIKE '%twitter%' OR name ILIKE '%follow%on x%';
UPDATE public.tasks SET target_url = 'https://t.me/bixgain', verification_rules = '{"type":"social_follow","platform":"telegram"}'::jsonb WHERE name ILIKE '%telegram%';
UPDATE public.tasks SET verification_rules = '{"type":"referral"}'::jsonb WHERE name ILIKE '%referral%';
UPDATE public.tasks SET verification_rules = '{"type":"login"}'::jsonb WHERE name ILIKE '%login%' OR name ILIKE '%daily%';
