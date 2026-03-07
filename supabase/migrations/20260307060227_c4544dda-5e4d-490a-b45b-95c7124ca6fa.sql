
-- 1. Fix admin_grant_xp: add admin authorization check
CREATE OR REPLACE FUNCTION public.admin_grant_xp(p_user uuid, p_xp integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  UPDATE users SET total_xp = total_xp + p_xp WHERE id = p_user;
END;
$$;

-- 2. Fix admin_grant_bix: add admin authorization check
CREATE OR REPLACE FUNCTION public.admin_grant_bix(p_user uuid, p_bix integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  UPDATE users
  SET bix_balance = bix_balance + p_bix, total_bix = total_bix + p_bix
  WHERE id = p_user;
END;
$$;

-- 3. Fix users table RLS: convert to proper permissive policies
-- Drop existing restrictive SELECT policies
DROP POLICY IF EXISTS "Admins can select all users" ON public.users;
DROP POLICY IF EXISTS "Users can view own row" ON public.users;
DROP POLICY IF EXISTS "Admins Full Access" ON public.users;
DROP POLICY IF EXISTS "Users update safe fields" ON public.users;
DROP POLICY IF EXISTS "Admins can update users" ON public.users;
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Users can view own row" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can select all users" ON public.users
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Users update safe fields" ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can update users" ON public.users
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete users" ON public.users
  FOR DELETE TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert users" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

-- 4. Fix profiles table RLS: add user-scoped permissive SELECT
DROP POLICY IF EXISTS "Admins Full Access" ON public.profiles;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can access all profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- 5. Fix wallets table RLS: ensure proper permissive policies
DROP POLICY IF EXISTS "Admins Full Access" ON public.wallets;
DROP POLICY IF EXISTS "Users view own wallets" ON public.wallets;

CREATE POLICY "Users view own wallets" ON public.wallets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can access all wallets" ON public.wallets
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
