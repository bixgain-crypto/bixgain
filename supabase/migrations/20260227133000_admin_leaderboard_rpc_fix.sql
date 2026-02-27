-- Fix admin + leaderboard data access under strict RLS by exposing
-- SECURITY DEFINER RPCs and adding compatibility xp/level columns.

-- 1) Compatibility columns expected by leaderboard/admin consumers.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS xp INTEGER,
  ADD COLUMN IF NOT EXISTS level INTEGER;

UPDATE public.users
SET
  xp = COALESCE(total_xp, xp, 0),
  level = COALESCE(current_level, level, 1)
WHERE xp IS NULL OR level IS NULL;

ALTER TABLE public.users
  ALTER COLUMN xp SET DEFAULT 0,
  ALTER COLUMN xp SET NOT NULL,
  ALTER COLUMN level SET DEFAULT 1,
  ALTER COLUMN level SET NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_users_xp_level_alias()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.xp := COALESCE(NEW.total_xp, 0);
  NEW.level := COALESCE(NEW.current_level, 1);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_sync_users_xp_level_alias ON public.users;
CREATE TRIGGER zz_sync_users_xp_level_alias
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_users_xp_level_alias();

-- 2) Admin dashboard stats RPC (admin-only).
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS TABLE (
  total_users BIGINT,
  tvl_locked NUMERIC,
  rewards_distributed NUMERIC,
  active_stakes BIGINT,
  pending_claims BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller UUID := auth.uid();
BEGIN
  IF _caller IS NULL OR NOT public.is_admin(_caller) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::BIGINT FROM public.users),
    -- No locked_balance column exists in current schema; use active stake principal as TVL.
    COALESCE((SELECT SUM(s.amount) FROM public.stakes s WHERE s.status = 'active'), 0)::NUMERIC,
    COALESCE((
      SELECT SUM(a.points_earned)
      FROM public.activities a
      WHERE COALESCE(a.metadata->>'unit', '') = 'bix'
    ), 0)::NUMERIC,
    (SELECT COUNT(*)::BIGINT FROM public.stakes s WHERE s.status = 'active'),
    (SELECT COUNT(*)::BIGINT FROM public.claims c WHERE c.status = 'pending');
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_stats() TO authenticated, service_role;

-- 3) Public leaderboard RPC under SECURITY DEFINER (authenticated only).
CREATE OR REPLACE FUNCTION public.get_leaderboard()
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  xp INTEGER,
  level INTEGER,
  level_name TEXT,
  rank BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller UUID := auth.uid();
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      u.id AS user_id,
      COALESCE(NULLIF(TRIM(u.username), ''), 'user-' || SUBSTRING(u.id::TEXT, 1, 6)) AS username,
      COALESCE(u.xp, u.total_xp, 0)::INTEGER AS xp,
      COALESCE(u.level, u.current_level, 1)::INTEGER AS level,
      COALESCE(NULLIF(TRIM(u.level_name), ''), 'Explorer') AS level_name,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(u.xp, u.total_xp, 0) DESC, u.id ASC
      )::BIGINT AS rank
    FROM public.users u
  )
  SELECT
    r.user_id,
    r.username,
    r.xp,
    r.level,
    r.level_name,
    r.rank
  FROM ranked r
  ORDER BY r.rank
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_leaderboard() TO authenticated, service_role;
