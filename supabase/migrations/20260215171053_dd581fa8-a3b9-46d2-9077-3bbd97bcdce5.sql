
-- =============================================
-- BIXGAIN REWARDS - Complete Database Schema
-- =============================================

-- 1. ENUMS
CREATE TYPE public.claim_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled', 'processing');
CREATE TYPE public.transaction_type AS ENUM ('earn', 'spend', 'adjustment', 'tax_deduction', 'bonus', 'referral');
CREATE TYPE public.fraud_flag_status AS ENUM ('open', 'investigating', 'resolved', 'dismissed');
CREATE TYPE public.wallet_type AS ENUM ('bix', 'eth', 'btc', 'usdt');
CREATE TYPE public.activity_type AS ENUM ('task_completion', 'referral', 'staking', 'login', 'social', 'custom');

-- 2. BASE TABLES

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  referral_code TEXT UNIQUE,
  referred_by UUID REFERENCES public.profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_frozen BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_profiles_referral_code ON public.profiles(referral_code);

-- Admin Roles (separate table per security requirements)
CREATE TABLE public.admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin Users
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role_id UUID REFERENCES public.admin_roles(id) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_admin_users_user_id ON public.admin_users(user_id);

-- Admin Permissions
CREATE TABLE public.admin_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES public.admin_roles(id) ON DELETE CASCADE NOT NULL,
  permission_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_key)
);
CREATE INDEX idx_admin_permissions_role_id ON public.admin_permissions(role_id);

-- Tasks
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  reward_points NUMERIC(18,8) NOT NULL DEFAULT 0,
  task_type public.activity_type NOT NULL DEFAULT 'custom',
  requirements JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  max_completions_per_user INTEGER DEFAULT 1,
  total_budget NUMERIC(18,8),
  total_claimed NUMERIC(18,8) NOT NULL DEFAULT 0,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_active ON public.tasks(is_active);

-- Wallets
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  wallet_type public.wallet_type NOT NULL DEFAULT 'bix',
  address TEXT,
  balance NUMERIC(18,8) NOT NULL DEFAULT 0,
  pending_balance NUMERIC(18,8) NOT NULL DEFAULT 0,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, wallet_type)
);
CREATE INDEX idx_wallets_user_id ON public.wallets(user_id);

-- Activities
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  task_id UUID REFERENCES public.tasks(id),
  activity_type public.activity_type NOT NULL,
  description TEXT,
  points_earned NUMERIC(18,8) NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_activities_user_id ON public.activities(user_id);
CREATE INDEX idx_activities_task_id ON public.activities(task_id);
-- Prevent duplicate task completions
CREATE UNIQUE INDEX idx_activities_unique_task ON public.activities(user_id, task_id) WHERE task_id IS NOT NULL;

-- Reward Transactions Ledger (append-only, financial-safe)
CREATE TABLE public.reward_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  activity_id UUID REFERENCES public.activities(id),
  task_id UUID REFERENCES public.tasks(id),
  transaction_type public.transaction_type NOT NULL,
  gross_amount NUMERIC(18,8) NOT NULL,
  tax_amount NUMERIC(18,8) NOT NULL DEFAULT 0,
  net_amount NUMERIC(18,8) NOT NULL,
  running_balance NUMERIC(18,8) NOT NULL DEFAULT 0,
  description TEXT,
  idempotency_key TEXT UNIQUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reward_tx_user_id ON public.reward_transactions(user_id);
CREATE INDEX idx_reward_tx_activity ON public.reward_transactions(activity_id);
CREATE INDEX idx_reward_tx_created ON public.reward_transactions(created_at);
CREATE INDEX idx_reward_tx_type ON public.reward_transactions(transaction_type);

-- Tax Rules
CREATE TABLE public.tax_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  min_threshold NUMERIC(18,8) DEFAULT 0,
  applicable_to TEXT NOT NULL DEFAULT 'rewards',
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tax Transactions (append-only ledger)
CREATE TABLE public.tax_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reward_transaction_id UUID REFERENCES public.reward_transactions(id),
  tax_rule_id UUID REFERENCES public.tax_rules(id),
  taxable_amount NUMERIC(18,8) NOT NULL,
  tax_rate NUMERIC(5,4) NOT NULL,
  tax_amount NUMERIC(18,8) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tax_tx_user_id ON public.tax_transactions(user_id);
CREATE INDEX idx_tax_tx_reward ON public.tax_transactions(reward_transaction_id);

-- Claims with approval workflow
CREATE TABLE public.claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(18,8) NOT NULL,
  tax_amount NUMERIC(18,8) NOT NULL DEFAULT 0,
  net_amount NUMERIC(18,8) NOT NULL,
  wallet_id UUID REFERENCES public.wallets(id),
  status public.claim_status NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_claims_user_id ON public.claims(user_id);
CREATE INDEX idx_claims_status ON public.claims(status);

-- Admin Audit Log (append-only)
CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES auth.users(id) NOT NULL,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id UUID,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_admin ON public.admin_audit_log(admin_user_id);
CREATE INDEX idx_audit_created ON public.admin_audit_log(created_at);
CREATE INDEX idx_audit_action ON public.admin_audit_log(action);

-- Platform Revenue
CREATE TABLE public.platform_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  amount NUMERIC(18,8) NOT NULL,
  description TEXT,
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Platform Settings
CREATE TABLE public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fraud Flags
CREATE TABLE public.fraud_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  flag_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  status public.fraud_flag_status NOT NULL DEFAULT 'open',
  related_table TEXT,
  related_id UUID,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fraud_user ON public.fraud_flags(user_id);
CREATE INDEX idx_fraud_status ON public.fraud_flags(status);

-- Reward Limits
CREATE TABLE public.reward_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  limit_type TEXT NOT NULL,
  limit_value NUMERIC(18,8) NOT NULL,
  period TEXT DEFAULT 'daily',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reward_limits_user ON public.reward_limits(user_id);

-- 3. HELPER FUNCTIONS (SECURITY DEFINER)

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE user_id = _user_id AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.has_admin_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users au
    JOIN public.admin_permissions ap ON ap.role_id = au.role_id
    WHERE au.user_id = _user_id AND au.is_active = true AND ap.permission_key = _permission
  );
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  
  -- Auto-create BIX wallet
  INSERT INTO public.wallets (user_id, wallet_type, is_primary)
  VALUES (NEW.id, 'bix', true);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON public.claims FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_admin_users_updated_at BEFORE UPDATE ON public.admin_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_reward_limits_updated_at BEFORE UPDATE ON public.reward_limits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. ENABLE RLS ON ALL TABLES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_limits ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES

-- Profiles
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Wallets
CREATE POLICY "Users view own wallets" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Users insert own wallets" ON public.wallets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own wallets" ON public.wallets FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own wallets" ON public.wallets FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Activities
CREATE POLICY "Users view own activities" ON public.activities FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Users insert own activities" ON public.activities FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Tasks (public read, admin write)
CREATE POLICY "Anyone can view active tasks" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update tasks" ON public.tasks FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins delete tasks" ON public.tasks FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Reward Transactions (read-only for users, append-only via functions)
CREATE POLICY "Users view own reward tx" ON public.reward_transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "System insert reward tx" ON public.reward_transactions FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

-- Tax Rules (public read, admin write)
CREATE POLICY "Anyone view tax rules" ON public.tax_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tax rules" ON public.tax_rules FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update tax rules" ON public.tax_rules FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- Tax Transactions (read-only)
CREATE POLICY "Users view own tax tx" ON public.tax_transactions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "System insert tax tx" ON public.tax_transactions FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

-- Claims
CREATE POLICY "Users view own claims" ON public.claims FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Users create claims" ON public.claims FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update pending claims" ON public.claims FOR UPDATE TO authenticated USING (
  (user_id = auth.uid() AND status = 'pending') OR public.is_admin(auth.uid())
);

-- Admin Users
CREATE POLICY "Admins view admin users" ON public.admin_users FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage admin users" ON public.admin_users FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update admin users" ON public.admin_users FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- Admin Roles
CREATE POLICY "Admins view roles" ON public.admin_roles FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage roles" ON public.admin_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update roles" ON public.admin_roles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- Admin Permissions
CREATE POLICY "Admins view permissions" ON public.admin_permissions FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage permissions" ON public.admin_permissions FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

-- Admin Audit Log (append-only, admin read)
CREATE POLICY "Admins view audit log" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert audit log" ON public.admin_audit_log FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

-- Platform Revenue (admin only)
CREATE POLICY "Admins view revenue" ON public.platform_revenue FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins insert revenue" ON public.platform_revenue FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

-- Platform Settings (public read, admin write)
CREATE POLICY "Anyone view settings" ON public.platform_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage settings" ON public.platform_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update settings" ON public.platform_settings FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- Fraud Flags
CREATE POLICY "Users view own fraud flags" ON public.fraud_flags FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage fraud flags" ON public.fraud_flags FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update fraud flags" ON public.fraud_flags FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- Reward Limits
CREATE POLICY "View reward limits" ON public.reward_limits FOR SELECT TO authenticated USING (user_id IS NULL OR user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage reward limits" ON public.reward_limits FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins update reward limits" ON public.reward_limits FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- 6. REPORTING VIEWS

CREATE VIEW public.v_admin_claims_overview
WITH (security_invoker = on)
AS
SELECT 
  c.id, c.amount, c.tax_amount, c.net_amount, c.status, c.created_at, c.approved_at,
  p.display_name AS user_name,
  w.address AS wallet_address,
  w.wallet_type
FROM public.claims c
JOIN public.profiles p ON p.user_id = c.user_id
LEFT JOIN public.wallets w ON w.id = c.wallet_id;

CREATE VIEW public.v_admin_user_summary
WITH (security_invoker = on)
AS
SELECT 
  p.id, p.user_id, p.display_name, p.is_active, p.is_frozen, p.created_at,
  COALESCE(w.balance, 0) AS bix_balance,
  COALESCE(w.pending_balance, 0) AS pending_balance,
  (SELECT COUNT(*) FROM public.activities a WHERE a.user_id = p.user_id) AS total_activities,
  (SELECT COUNT(*) FROM public.claims cl WHERE cl.user_id = p.user_id) AS total_claims,
  (SELECT COUNT(*) FROM public.fraud_flags ff WHERE ff.user_id = p.user_id AND ff.status = 'open') AS open_fraud_flags
FROM public.profiles p
LEFT JOIN public.wallets w ON w.user_id = p.user_id AND w.wallet_type = 'bix';

CREATE VIEW public.v_platform_stats
WITH (security_invoker = on)
AS
SELECT 
  (SELECT COUNT(*) FROM public.profiles) AS total_users,
  (SELECT COUNT(*) FROM public.profiles WHERE is_active = true) AS active_users,
  (SELECT COALESCE(SUM(balance), 0) FROM public.wallets WHERE wallet_type = 'bix') AS total_bix_in_circulation,
  (SELECT COUNT(*) FROM public.claims WHERE status = 'pending') AS pending_claims,
  (SELECT COALESCE(SUM(amount), 0) FROM public.claims WHERE status = 'approved') AS total_approved_claims,
  (SELECT COALESCE(SUM(amount), 0) FROM public.platform_revenue) AS total_revenue;

-- 7. SEED DEFAULT DATA

-- Default admin role
INSERT INTO public.admin_roles (name, description) VALUES 
  ('super_admin', 'Full platform access'),
  ('moderator', 'User management and claim approvals'),
  ('viewer', 'Read-only access to admin dashboard');

-- Default permissions for super_admin
INSERT INTO public.admin_permissions (role_id, permission_key)
SELECT r.id, p.key FROM public.admin_roles r
CROSS JOIN (VALUES 
  ('users.manage'), ('users.freeze'), ('claims.approve'), ('claims.reject'),
  ('tasks.manage'), ('settings.manage'), ('revenue.view'), ('audit.view'),
  ('fraud.manage'), ('limits.manage'), ('roles.manage'), ('tax.manage')
) AS p(key)
WHERE r.name = 'super_admin';

-- Default permissions for moderator
INSERT INTO public.admin_permissions (role_id, permission_key)
SELECT r.id, p.key FROM public.admin_roles r
CROSS JOIN (VALUES 
  ('users.manage'), ('claims.approve'), ('claims.reject'), ('fraud.manage')
) AS p(key)
WHERE r.name = 'moderator';

-- Default platform settings
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('platform_name', 'Bixgain Rewards', 'Platform display name'),
  ('token_name', 'BIX', 'Token symbol'),
  ('min_claim_amount', '10', 'Minimum BIX to claim'),
  ('max_daily_earn', '1000', 'Maximum BIX earnable per day'),
  ('claim_approval_required', 'true', 'Whether claims need admin approval'),
  ('referral_bonus', '50', 'BIX bonus for referrals'),
  ('admin_email', 'bixgain@gmail.com', 'Admin contact email');

-- Default tax rule
INSERT INTO public.tax_rules (name, description, rate, applicable_to) VALUES
  ('Standard Tax', 'Default tax on reward claims', 0.05, 'claims');

-- Default global reward limits
INSERT INTO public.reward_limits (limit_type, limit_value, period) VALUES
  ('daily_earn', 1000, 'daily'),
  ('weekly_earn', 5000, 'weekly'),
  ('max_claim', 10000, 'single');
