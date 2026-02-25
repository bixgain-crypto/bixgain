-- Daily reward claim RPC with 24h cooldown, backed by users + activities

DROP FUNCTION IF EXISTS public.claim_daily_reward();
DROP FUNCTION IF EXISTS public.claim_daily_reward(UUID);

CREATE OR REPLACE FUNCTION public.claim_daily_reward(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _effective_user_id UUID;
  _last_claim_at TIMESTAMPTZ;
  _next_claim_at TIMESTAMPTZ;
  _reward_xp INTEGER;
  _reward_options INTEGER[] := ARRAY[25, 50, 75];
  _user_row public.users%ROWTYPE;
BEGIN
  _effective_user_id := COALESCE(auth.uid(), p_user_id);

  IF _effective_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF to_regprocedure('public.progression_ensure_user_row(uuid)') IS NOT NULL THEN
    PERFORM public.progression_ensure_user_row(_effective_user_id);
  ELSE
    INSERT INTO public.users (id)
    VALUES (_effective_user_id)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  SELECT a.created_at
  INTO _last_claim_at
  FROM public.activities a
  WHERE a.user_id = _effective_user_id
    AND a.activity_type = 'custom'
    AND COALESCE(a.metadata->>'source', '') = 'claim_daily_reward'
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF _last_claim_at IS NOT NULL AND _last_claim_at > (now() - INTERVAL '24 hours') THEN
    _next_claim_at := _last_claim_at + INTERVAL '24 hours';
    RAISE EXCEPTION 'Daily reward already claimed'
      USING ERRCODE = 'P0001',
            DETAIL = to_char(_next_claim_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  END IF;

  _reward_xp := _reward_options[1 + FLOOR(random() * array_length(_reward_options, 1))::INTEGER];
  _next_claim_at := now() + INTERVAL '24 hours';

  IF to_regprocedure('public.progression_award_xp(uuid,integer)') IS NOT NULL THEN
    EXECUTE 'SELECT * FROM public.progression_award_xp($1, $2)'
    INTO _user_row
    USING _effective_user_id, _reward_xp;
  ELSE
    UPDATE public.users
    SET total_xp = COALESCE(total_xp, 0) + _reward_xp
    WHERE id = _effective_user_id
    RETURNING * INTO _user_row;
  END IF;

  INSERT INTO public.activities (user_id, activity_type, points_earned, description, metadata)
  VALUES (
    _effective_user_id,
    'custom',
    _reward_xp,
    'Daily boost reward +' || _reward_xp || ' XP',
    jsonb_build_object(
      'source', 'claim_daily_reward',
      'reward_xp', _reward_xp,
      'next_claim_at', to_char(_next_claim_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'reward_xp', _reward_xp,
    'awarded_xp', _reward_xp,
    'claimed_xp', _reward_xp,
    'next_claim_at', to_char(_next_claim_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'user', to_jsonb(_user_row)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_daily_reward()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public.claim_daily_reward(auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.claim_daily_reward() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_daily_reward(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_reward() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.claim_daily_reward(UUID) TO authenticated, service_role;
