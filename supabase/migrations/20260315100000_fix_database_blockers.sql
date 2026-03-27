-- Migration to unblock admin operations and user profile access

-- 1. Drop triggers blocking admin edits and balance updates
DROP TRIGGER IF EXISTS admin_edit_block ON public.users;
DROP TRIGGER IF EXISTS balance_block ON public.users;
DROP FUNCTION IF EXISTS public.prevent_admin_edit();
DROP FUNCTION IF EXISTS public.prevent_balance_edit();

-- 2. Add SELECT policy for regular users to view their own data
-- This allows users to load their profile, XP, balance, and level.
CREATE POLICY "Users can view own row" ON public.users FOR SELECT USING (id = auth.uid());