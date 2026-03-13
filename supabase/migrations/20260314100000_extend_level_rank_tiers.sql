-- Extend progression levels/ranks to align with frontend LEVEL_TIERS

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

  PERFORM public.progression_ensure_user_row(p_user_id);

  UPDATE public.users
  SET total_xp = COALESCE(total_xp, 0) + p_xp_amount,
      xp = COALESCE(xp, 0) + p_xp_amount,
      weekly_xp = COALESCE(weekly_xp, 0) + p_xp_amount,
      season_xp = COALESCE(season_xp, 0) + p_xp_amount,
      total_xp_earned = COALESCE(total_xp_earned, 0) + p_xp_amount
  WHERE id = p_user_id
  RETURNING * INTO _user;

  _new_level := CASE
    WHEN _user.total_xp >= 500000 THEN 10
    WHEN _user.total_xp >= 360000 THEN 9
    WHEN _user.total_xp >= 265000 THEN 8
    WHEN _user.total_xp >= 185000 THEN 7
    WHEN _user.total_xp >= 120000 THEN 6
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
    WHEN 6 THEN 'Master'
    WHEN 7 THEN 'Grandmaster'
    WHEN 8 THEN 'Mythic'
    WHEN 9 THEN 'Immortal'
    WHEN 10 THEN 'Apex'
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

  PERFORM public.convert_xp_to_bix(p_user_id);

  SELECT * INTO _user FROM public.users WHERE id = p_user_id;
  RETURN _user;
END;
$$;

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
    WHEN _user.total_xp >= 500000 THEN 10
    WHEN _user.total_xp >= 360000 THEN 9
    WHEN _user.total_xp >= 265000 THEN 8
    WHEN _user.total_xp >= 185000 THEN 7
    WHEN _user.total_xp >= 120000 THEN 6
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
    WHEN 6 THEN 'Master'
    WHEN 7 THEN 'Grandmaster'
    WHEN 8 THEN 'Mythic'
    WHEN 9 THEN 'Immortal'
    WHEN 10 THEN 'Apex'
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
