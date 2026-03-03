
-- ============================================================
-- 1. Create missing progression_award_xp function
--    Called by: award_xp edge function, admin-operations grant_rewards
-- ============================================================
CREATE OR REPLACE FUNCTION public.progression_award_xp(p_user_id uuid, p_xp_amount integer)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user public.users%ROWTYPE;
  _new_level integer;
  _new_level_name text;
BEGIN
  IF p_xp_amount IS NULL OR p_xp_amount <= 0 THEN
    SELECT * INTO _user FROM public.users WHERE id = p_user_id;
    RETURN _user;
  END IF;

  -- Ensure user row exists
  PERFORM public.progression_ensure_user_row(p_user_id);

  UPDATE public.users
  SET total_xp = COALESCE(total_xp, 0) + p_xp_amount,
      xp = COALESCE(xp, 0) + p_xp_amount,
      weekly_xp = COALESCE(weekly_xp, 0) + p_xp_amount,
      season_xp = COALESCE(season_xp, 0) + p_xp_amount,
      total_xp_earned = COALESCE(total_xp_earned, 0) + p_xp_amount
  WHERE id = p_user_id
  RETURNING * INTO _user;

  -- Recalculate level based on total_xp thresholds matching client LEVEL_TIERS
  _new_level := CASE
    WHEN _user.total_xp >= 70000 THEN 5
    WHEN _user.total_xp >= 35000 THEN 4
    WHEN _user.total_xp >= 15000 THEN 3
    WHEN _user.total_xp >= 5000  THEN 2
    ELSE 1
  END;

  _new_level_name := CASE _new_level
    WHEN 1 THEN 'Explorer'
    WHEN 2 THEN 'Builder'
    WHEN 3 THEN 'Pro'
    WHEN 4 THEN 'Elite'
    WHEN 5 THEN 'Legend'
    ELSE 'Explorer'
  END;

  IF _new_level <> _user.current_level OR _new_level_name <> _user.level_name THEN
    UPDATE public.users
    SET current_level = _new_level,
        level = _new_level,
        level_name = _new_level_name
    WHERE id = p_user_id
    RETURNING * INTO _user;
  END IF;

  -- Auto-convert XP to BIX
  PERFORM public.convert_xp_to_bix(p_user_id);

  SELECT * INTO _user FROM public.users WHERE id = p_user_id;
  RETURN _user;
END;
$$;

-- ============================================================
-- 2. Create missing progression_spend_bix function
--    Called by: spend_bix edge function
-- ============================================================
CREATE OR REPLACE FUNCTION public.progression_spend_bix(p_user_id uuid, p_amount numeric)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user public.users%ROWTYPE;
  _current_balance numeric;
  _new_balance numeric;
BEGIN
  SELECT * INTO _user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  _current_balance := COALESCE(_user.bix_balance, 0);
  IF _current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient BIX balance';
  END IF;

  _new_balance := _current_balance - p_amount;

  UPDATE public.users
  SET bix_balance = _new_balance
  WHERE id = p_user_id
  RETURNING * INTO _user;

  INSERT INTO public.reward_transactions (
    user_id, transaction_type, gross_amount, tax_amount, net_amount,
    running_balance, description
  ) VALUES (
    p_user_id, 'spend', p_amount, 0, -p_amount,
    _new_balance, 'BIX spend'
  );

  RETURN _user;
END;
$$;

-- ============================================================
-- 3. Create missing progression_spend_xp function
--    Called by: spend_xp edge function
-- ============================================================
CREATE OR REPLACE FUNCTION public.progression_spend_xp(p_user_id uuid, p_amount integer)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user public.users%ROWTYPE;
BEGIN
  SELECT * INTO _user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF COALESCE(_user.total_xp, 0) < p_amount THEN
    RAISE EXCEPTION 'Insufficient XP balance';
  END IF;

  UPDATE public.users
  SET total_xp = COALESCE(total_xp, 0) - p_amount,
      xp = COALESCE(xp, 0) - p_amount
  WHERE id = p_user_id
  RETURNING * INTO _user;

  RETURN _user;
END;
$$;

-- ============================================================
-- 4. Create missing progression_convert_xp_to_bix function
--    Called by: convert_xp_to_bix edge function
-- ============================================================
CREATE OR REPLACE FUNCTION public.progression_convert_xp_to_bix(p_user_id uuid)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user public.users%ROWTYPE;
  _convertible integer;
  _already_converted integer;
  _new_bix integer;
BEGIN
  SELECT * INTO _user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  _convertible := FLOOR(COALESCE(_user.total_xp, 0) / 10000);
  _already_converted := COALESCE(_user.converted_xp, 0) / 10000;
  _new_bix := _convertible - _already_converted;

  IF _new_bix > 0 THEN
    UPDATE public.users
    SET bix_balance = COALESCE(bix_balance, 0) + _new_bix,
        total_bix = COALESCE(total_bix, 0) + _new_bix,
        converted_xp = COALESCE(converted_xp, 0) + (_new_bix * 10000)
    WHERE id = p_user_id
    RETURNING * INTO _user;
  END IF;

  RETURN _user;
END;
$$;

-- ============================================================
-- 5. Create missing progression_recalc_level function
--    Called by: recalc_level edge function
-- ============================================================
CREATE OR REPLACE FUNCTION public.progression_recalc_level(p_user_id uuid)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user public.users%ROWTYPE;
  _new_level integer;
  _new_level_name text;
BEGIN
  SELECT * INTO _user FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  _new_level := CASE
    WHEN _user.total_xp >= 70000 THEN 5
    WHEN _user.total_xp >= 35000 THEN 4
    WHEN _user.total_xp >= 15000 THEN 3
    WHEN _user.total_xp >= 5000  THEN 2
    ELSE 1
  END;

  _new_level_name := CASE _new_level
    WHEN 1 THEN 'Explorer'
    WHEN 2 THEN 'Builder'
    WHEN 3 THEN 'Pro'
    WHEN 4 THEN 'Elite'
    WHEN 5 THEN 'Legend'
    ELSE 'Explorer'
  END;

  UPDATE public.users
  SET current_level = _new_level,
      level = _new_level,
      level_name = _new_level_name
  WHERE id = p_user_id
  RETURNING * INTO _user;

  RETURN _user;
END;
$$;

-- ============================================================
-- 6. Fix stake_tokens function (wrong column names)
-- ============================================================
CREATE OR REPLACE FUNCTION public.stake_tokens(p_user_id uuid, p_plan_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plan RECORD;
    v_wallet RECORD;
    v_control RECORD;
BEGIN
    SELECT * INTO v_plan FROM staking_plans WHERE id = p_plan_id FOR UPDATE;
    IF NOT FOUND OR NOT v_plan.is_active THEN RAISE EXCEPTION 'Staking plan is not active'; END IF;
    IF p_amount < v_plan.min_amount THEN RAISE EXCEPTION 'Minimum stake is % BIX', v_plan.min_amount; END IF;
    IF v_plan.max_amount IS NOT NULL AND p_amount > v_plan.max_amount THEN RAISE EXCEPTION 'Maximum stake is % BIX', v_plan.max_amount; END IF;

    -- Check user balance from users table (source of truth)
    DECLARE v_balance numeric;
    BEGIN
      SELECT bix_balance INTO v_balance FROM users WHERE id = p_user_id FOR UPDATE;
      IF v_balance IS NULL OR v_balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    END;

    SELECT * INTO v_control FROM staking_control LIMIT 1 FOR UPDATE;
    IF v_control IS NOT NULL THEN
      IF NOT COALESCE(v_control.is_staking_enabled, true) THEN RAISE EXCEPTION 'Staking is disabled'; END IF;
      IF v_plan.max_total_pool IS NOT NULL AND COALESCE(v_plan.current_total_staked, 0) + p_amount > v_plan.max_total_pool THEN RAISE EXCEPTION 'Plan pool limit reached'; END IF;
      IF v_control.max_platform_staking IS NOT NULL AND COALESCE(v_control.total_platform_staked, 0) + p_amount > v_control.max_platform_staking THEN RAISE EXCEPTION 'Platform staking limit reached'; END IF;
    END IF;

    -- Deduct from user balance
    UPDATE users SET bix_balance = bix_balance - p_amount WHERE id = p_user_id;

    -- Create stake with correct column names
    INSERT INTO stakes (user_id, plan_id, amount, staked_at, matures_at, status)
    VALUES (p_user_id, p_plan_id, p_amount, now(), now() + (v_plan.duration_days || ' days')::interval, 'active');

    UPDATE staking_plans SET current_total_staked = COALESCE(current_total_staked, 0) + p_amount, total_active_stakers = COALESCE(total_active_stakers, 0) + 1 WHERE id = p_plan_id;
    
    IF v_control IS NOT NULL THEN
      UPDATE staking_control SET total_platform_staked = COALESCE(total_platform_staked, 0) + p_amount;
    END IF;
END;
$$;

-- ============================================================
-- 7. Fix spend_bix 2-param function (wrong column names)
-- ============================================================
CREATE OR REPLACE FUNCTION public.spend_bix(p_user_id uuid, p_amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_new_balance numeric;
BEGIN
  SELECT bix_balance INTO v_balance FROM users WHERE id = p_user_id FOR UPDATE;
  IF v_balance IS NULL OR v_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  v_new_balance := v_balance - p_amount;
  UPDATE users SET bix_balance = v_new_balance WHERE id = p_user_id;

  INSERT INTO reward_transactions (user_id, transaction_type, gross_amount, tax_amount, net_amount, running_balance, description)
  VALUES (p_user_id, 'spend', p_amount, 0, -p_amount, v_new_balance, 'BIX spend');
END;
$$;

-- ============================================================
-- 8. Add RLS to reward_pool table
-- ============================================================
ALTER TABLE public.reward_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage reward pool"
ON public.reward_pool FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Anyone can view reward pool"
ON public.reward_pool FOR SELECT
TO authenticated
USING (true);

-- ============================================================
-- 9. Add RLS to staking_control table
-- ============================================================
ALTER TABLE public.staking_control ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage staking control"
ON public.staking_control FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Anyone can view staking control"
ON public.staking_control FOR SELECT
TO authenticated
USING (true);
