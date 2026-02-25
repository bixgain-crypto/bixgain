-- Align auth signup flow with the core users table and prevent trigger conflicts

-- Ensure required columns exist on public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_role TEXT NOT NULL DEFAULT 'user';

-- Backfill username/admin fields for existing rows
UPDATE public.users
SET
  username = COALESCE(NULLIF(TRIM(username), ''), 'user-' || LEFT(id::text, 8)),
  is_admin = COALESCE(is_admin, false),
  admin_role = COALESCE(NULLIF(TRIM(admin_role), ''), 'user')
WHERE
  username IS NULL
  OR TRIM(username) = ''
  OR is_admin IS NULL
  OR admin_role IS NULL
  OR TRIM(admin_role) = '';

ALTER TABLE public.users
  ALTER COLUMN username SET NOT NULL,
  ALTER COLUMN is_admin SET DEFAULT false,
  ALTER COLUMN is_admin SET NOT NULL,
  ALTER COLUMN admin_role SET DEFAULT 'user',
  ALTER COLUMN admin_role SET NOT NULL;

-- Single canonical signup handler
CREATE OR REPLACE FUNCTION public.handle_new_user_core()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _username TEXT;
  _is_admin BOOLEAN := false;
  _admin_role TEXT := 'user';
BEGIN
  _username := NULLIF(
    TRIM(
      COALESCE(
        NEW.raw_user_meta_data->>'username',
        NEW.raw_user_meta_data->>'display_name',
        split_part(COALESCE(NEW.email, ''), '@', 1)
      )
    ),
    ''
  );

  IF _username IS NULL THEN
    _username := 'user-' || LEFT(NEW.id::text, 8);
  END IF;

  IF LOWER(COALESCE(NEW.email, '')) = 'bixgain@gmail.com' THEN
    _is_admin := true;
    _admin_role := 'super_admin';
  END IF;

  INSERT INTO public.users (id, username, is_admin, admin_role)
  VALUES (NEW.id, _username, _is_admin, _admin_role)
  ON CONFLICT (id) DO UPDATE
  SET
    username = COALESCE(NULLIF(public.users.username, ''), EXCLUDED.username),
    is_admin = COALESCE(public.users.is_admin, EXCLUDED.is_admin),
    admin_role = COALESCE(NULLIF(public.users.admin_role, ''), EXCLUDED.admin_role);

  -- Optional compatibility layer for legacy tables if still present
  IF to_regclass('public.profiles') IS NOT NULL THEN
    EXECUTE
      'INSERT INTO public.profiles (user_id, display_name)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE
       SET display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name)'
    USING NEW.id, _username;
  END IF;

  IF to_regclass('public.wallets') IS NOT NULL THEN
    EXECUTE
      'INSERT INTO public.wallets (user_id, wallet_type, is_primary)
       VALUES ($1, ''bix'', true)
       ON CONFLICT (user_id, wallet_type) DO NOTHING'
    USING NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Remove conflicting historical triggers and install one canonical trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_progression ON auth.users;
DROP TRIGGER IF EXISTS trg_auto_assign_admin ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_core ON auth.users;

CREATE TRIGGER on_auth_user_created_core
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_core();

-- Backfill rows for existing auth users
INSERT INTO public.users (id, username, is_admin, admin_role)
SELECT
  au.id,
  COALESCE(
    NULLIF(TRIM(au.raw_user_meta_data->>'username'), ''),
    NULLIF(TRIM(au.raw_user_meta_data->>'display_name'), ''),
    NULLIF(TRIM(split_part(COALESCE(au.email, ''), '@', 1)), ''),
    'user-' || LEFT(au.id::text, 8)
  ) AS username,
  CASE WHEN LOWER(COALESCE(au.email, '')) = 'bixgain@gmail.com' THEN true ELSE false END AS is_admin,
  CASE WHEN LOWER(COALESCE(au.email, '')) = 'bixgain@gmail.com' THEN 'super_admin' ELSE 'user' END AS admin_role
FROM auth.users au
ON CONFLICT (id) DO UPDATE
SET
  username = COALESCE(NULLIF(public.users.username, ''), EXCLUDED.username),
  is_admin = COALESCE(public.users.is_admin, EXCLUDED.is_admin),
  admin_role = COALESCE(NULLIF(public.users.admin_role, ''), EXCLUDED.admin_role);
