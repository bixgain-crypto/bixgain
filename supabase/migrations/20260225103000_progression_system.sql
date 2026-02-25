-- =============================================
-- Progression System (Supabase backend only)
-- =============================================

-- 1) Users progression table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  bix_balance INTEGER NOT NULL DEFAULT 0,
  total_bix INTEGER NOT NULL DEFAULT 0,
  total_xp INTEGER NOT NULL DEFAULT 0,
  converted_xp INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  level_name TEXT NOT NULL DEFAULT 'Explorer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS bix_balance INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_bix INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_xp INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS converted_xp INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_level INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS level_name TEXT NOT NULL DEFAULT 'Explorer';

UPDATE public.users
SET
  bix_balance = COALESCE(bix_balance, 0),
  total_bix = COALESCE(total_bix, 0),
  total_xp = COALESCE(total_xp, 0),
  converted_xp = COALESCE(converted_xp, 0),
  current_level = COALESCE(current_level, 1),
  level_name = COALESCE(level_name, 'Explorer')
WHERE
  bix_balance IS NULL
  OR total_bix IS NULL
  OR total_xp IS NULL
  OR converted_xp IS NULL
  OR current_level IS NULL
  OR level_name IS NULL;

ALTER TABLE public.users
  ALTER COLUMN bix_balance SET DEFAULT 0,
  ALTER COLUMN bix_balance SET NOT NULL,
  ALTER COLUMN total_bix SET DEFAULT 0,
  ALTER COLUMN total_bix SET NOT NULL,
  ALTER COLUMN total_xp SET DEFAULT 0,
  ALTER COLUMN total_xp SET NOT NULL,
  ALTER COLUMN converted_xp SET DEFAULT 0,
  ALTER COLUMN converted_xp SET NOT NULL,
  ALTER COLUMN current_level SET DEFAULT 1,
  ALTER COLUMN current_level SET NOT NULL,
  ALTER COLUMN level_name SET DEFAULT 'Explorer',
  ALTER COLUMN level_name SET NOT NULL;

-- Backfill progression rows for existing auth users
INSERT INTO public.users (id)
SELECT au.id
FROM auth.users au
ON CONFLICT (id) DO NOTHING;

-- 2) Integrity constraints
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_bix_balance_nonnegative'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_bix_balance_nonnegative CHECK (bix_balance >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_total_bix_nonnegative'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_total_bix_nonnegative CHECK (total_bix >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_total_xp_nonnegative'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_total_xp_nonnegative CHECK (total_xp >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_converted_xp_nonnegative'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_converted_xp_nonnegative CHECK (converted_xp >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_converted_xp_lte_total_xp'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_converted_xp_lte_total_xp CHECK (converted_xp <= total_xp);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_level_valid'
      AND conrelid = 'public.users'::regclass
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_level_valid CHECK (current_level BETWEEN 1 AND 5);
  END IF;
END
$$;

-- 3) Level mapping helper
CREATE OR REPLACE FUNCTION public.progression_level_from_total_bix(p_total_bix INTEGER)
RETURNS TABLE(level_value INTEGER, level_label TEXT)
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN COALESCE(p_total_bix, 0) >= 10000 THEN 5
      WHEN COALESCE(p_total_bix, 0) >= 5000 THEN 4
      WHEN COALESCE(p_total_bix, 0) >= 2000 THEN 3
      WHEN COALESCE(p_total_bix, 0) >= 500 THEN 2
      ELSE 1
    END AS level_value,
    CASE
      WHEN COALESCE(p_total_bix, 0) >= 10000 THEN 'Legend'
      WHEN COALESCE(p_total_bix, 0) >= 5000 THEN 'Elite'
      WHEN COALESCE(p_total_bix, 0) >= 2000 THEN 'Pro'
      WHEN COALESCE(p_total_bix, 0) >= 500 THEN 'Builder'
      ELSE 'Explorer'
    END AS level_label;
$$;

-- 4) Trigger guard for integrity + automatic level correction
CREATE OR REPLACE FUNCTION public.progression_users_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _level INTEGER;
  _name TEXT;
BEGIN
  NEW.bix_balance := COALESCE(NEW.bix_balance, 0);
  NEW.total_bix := COALESCE(NEW.total_bix, 0);
  NEW.total_xp := COALESCE(NEW.total_xp, 0);
  NEW.converted_xp := COALESCE(NEW.converted_xp, 0);

  IF NEW.bix_balance < 0 THEN
    RAISE EXCEPTION 'bix_balance cannot be negative';
  END IF;

  IF NEW.total_bix < 0 THEN
    RAISE EXCEPTION 'total_bix cannot be negative';
  END IF;

  IF NEW.total_xp < 0 THEN
    RAISE EXCEPTION 'total_xp cannot be negative';
  END IF;

  IF NEW.converted_xp < 0 THEN
    RAISE EXCEPTION 'converted_xp cannot be negative';
  END IF;

  IF NEW.converted_xp > NEW.total_xp THEN
    RAISE EXCEPTION 'converted_xp cannot exceed total_xp';
  END IF;

  SELECT level_value, level_label
  INTO _level, _name
  FROM public.progression_level_from_total_bix(NEW.total_bix);

  NEW.current_level := _level;
  NEW.level_name := _name;
  NEW.updated_at := now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_progression_users_guard ON public.users;
CREATE TRIGGER trg_progression_users_guard
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.progression_users_guard();

-- 5) Keep users table synced with auth.users
CREATE OR REPLACE FUNCTION public.handle_new_progression_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_progression ON auth.users;
CREATE TRIGGER on_auth_user_created_progression
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_progression_user();

-- 6) RLS + privilege model
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read Own Profile" ON public.users;
CREATE POLICY "Read Own Profile"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Service Role Full Access" ON public.users;
CREATE POLICY "Service Role Full Access"
ON public.users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

REVOKE ALL ON TABLE public.users FROM anon;
REVOKE ALL ON TABLE public.users FROM authenticated;
GRANT SELECT ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;

-- 7) Atomic progression RPCs
CREATE OR REPLACE FUNCTION public.progression_ensure_user_row(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id)
  VALUES (p_user_id)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.progression_convert_xp_to_bix(p_user_id UUID)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_row public.users%ROWTYPE;
  _convertible INTEGER;
  _already_converted INTEGER;
  _new_bix INTEGER;
BEGIN
  PERFORM public.progression_ensure_user_row(p_user_id);

  SELECT *
  INTO _user_row
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  _convertible := _user_row.total_xp / 10000;
  _already_converted := _user_row.converted_xp / 10000;
  _new_bix := _convertible - _already_converted;

  IF _new_bix > 0 THEN
    UPDATE public.users
    SET
      bix_balance = bix_balance + _new_bix,
      total_bix = total_bix + _new_bix,
      converted_xp = converted_xp + (_new_bix * 10000)
    WHERE id = p_user_id
    RETURNING * INTO _user_row;
  END IF;

  RETURN _user_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.progression_recalc_level(p_user_id UUID)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_row public.users%ROWTYPE;
  _level INTEGER;
  _name TEXT;
BEGIN
  PERFORM public.progression_ensure_user_row(p_user_id);

  SELECT *
  INTO _user_row
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT level_value, level_label
  INTO _level, _name
  FROM public.progression_level_from_total_bix(_user_row.total_bix);

  UPDATE public.users
  SET
    current_level = _level,
    level_name = _name
  WHERE id = p_user_id
  RETURNING * INTO _user_row;

  RETURN _user_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.progression_award_xp(p_user_id UUID, p_xp_amount INTEGER)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_row public.users%ROWTYPE;
BEGIN
  IF p_xp_amount IS NULL OR p_xp_amount <= 0 THEN
    RAISE EXCEPTION 'xp_amount must be greater than zero';
  END IF;

  PERFORM public.progression_ensure_user_row(p_user_id);

  UPDATE public.users
  SET total_xp = total_xp + p_xp_amount
  WHERE id = p_user_id
  RETURNING * INTO _user_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Chain required progression steps atomically.
  PERFORM public.progression_convert_xp_to_bix(p_user_id);
  SELECT * INTO _user_row FROM public.progression_recalc_level(p_user_id);

  RETURN _user_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.progression_spend_bix(p_user_id UUID, p_amount INTEGER)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_row public.users%ROWTYPE;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be greater than zero';
  END IF;

  PERFORM public.progression_ensure_user_row(p_user_id);

  SELECT *
  INTO _user_row
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF _user_row.bix_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient bix_balance';
  END IF;

  UPDATE public.users
  SET bix_balance = bix_balance - p_amount
  WHERE id = p_user_id
  RETURNING * INTO _user_row;

  SELECT * INTO _user_row FROM public.progression_recalc_level(p_user_id);
  RETURN _user_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.progression_spend_xp(p_user_id UUID, p_amount INTEGER)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_row public.users%ROWTYPE;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be greater than zero';
  END IF;

  PERFORM public.progression_ensure_user_row(p_user_id);

  SELECT *
  INTO _user_row
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF _user_row.total_xp < p_amount THEN
    RAISE EXCEPTION 'Insufficient total_xp';
  END IF;

  IF (_user_row.total_xp - p_amount) < _user_row.converted_xp THEN
    RAISE EXCEPTION 'Cannot spend already converted XP';
  END IF;

  UPDATE public.users
  SET total_xp = total_xp - p_amount
  WHERE id = p_user_id
  RETURNING * INTO _user_row;

  SELECT * INTO _user_row FROM public.progression_recalc_level(p_user_id);
  RETURN _user_row;
END;
$$;

-- 8) RPC execution hardening
REVOKE ALL ON FUNCTION public.progression_ensure_user_row(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progression_convert_xp_to_bix(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progression_recalc_level(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progression_award_xp(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progression_spend_bix(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.progression_spend_xp(UUID, INTEGER) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.progression_ensure_user_row(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.progression_convert_xp_to_bix(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.progression_recalc_level(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.progression_award_xp(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.progression_spend_bix(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.progression_spend_xp(UUID, INTEGER) TO service_role;
