-- Canonicalize admin authorization on users.is_admin and align legacy rows.

-- 1) Backfill users admin flags from active legacy admin_users memberships.
UPDATE public.users u
SET
  is_admin = true,
  admin_role = CASE
    WHEN COALESCE(NULLIF(u.admin_role, ''), 'user') = 'user'
      THEN COALESCE(NULLIF(ar.name, ''), 'admin')
    ELSE u.admin_role
  END
FROM public.admin_users au
LEFT JOIN public.admin_roles ar ON ar.id = au.role_id
WHERE au.user_id = u.id
  AND au.is_active = true
  AND (
    COALESCE(u.is_admin, false) = false
    OR COALESCE(NULLIF(u.admin_role, ''), 'user') = 'user'
  );

-- 2) Canonical admin gate: read from users.is_admin only.
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT u.is_admin FROM public.users u WHERE u.id = _user_id),
    false
  );
$$;

-- 3) Keep legacy admin_users rows inactive for non-admin users to avoid drift.
UPDATE public.admin_users au
SET
  is_active = false,
  updated_at = now()
WHERE au.is_active = true
  AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = au.user_id
      AND COALESCE(u.is_admin, false) = false
  );
