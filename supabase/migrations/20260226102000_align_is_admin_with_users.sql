-- Keep admin checks consistent with the canonical users.is_admin flag.
-- This prevents RLS/admin gate mismatches between legacy admin_users and
-- progression-era users metadata.

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      (SELECT u.is_admin FROM public.users u WHERE u.id = _user_id),
      false
    )
    OR EXISTS (
      SELECT 1
      FROM public.admin_users au
      WHERE au.user_id = _user_id
        AND au.is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.has_admin_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.admin_users au
      JOIN public.admin_permissions ap ON ap.role_id = au.role_id
      WHERE au.user_id = _user_id
        AND au.is_active = true
        AND ap.permission_key = _permission
    )
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = _user_id
        AND u.is_admin = true
        AND COALESCE(NULLIF(u.admin_role, ''), 'user') = 'super_admin'
    );
$$;
