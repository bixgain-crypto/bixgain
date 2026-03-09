-- Mini Games system:
-- - game catalog
-- - daily energy
-- - secure game sessions
-- - verified score submission
-- - daily login + first game + combo + lucky drop bonuses
-- - profile stats RPC

CREATE TABLE IF NOT EXISTS public.mini_games_catalog (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  reward_rate_text TEXT NOT NULL,
  xp_per_unit INTEGER NOT NULL DEFAULT 1,
  max_score INTEGER NOT NULL DEFAULT 100,
  max_xp INTEGER NOT NULL DEFAULT 1000,
  status TEXT NOT NULL DEFAULT 'coming_soon',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mini_games_catalog_status_valid CHECK (status IN ('active', 'beta', 'coming_soon')),
  CONSTRAINT mini_games_catalog_xp_per_unit_positive CHECK (xp_per_unit > 0),
  CONSTRAINT mini_games_catalog_max_score_positive CHECK (max_score > 0),
  CONSTRAINT mini_games_catalog_max_xp_positive CHECK (max_xp > 0)
);

INSERT INTO public.mini_games_catalog (
  slug,
  name,
  description,
  reward_rate_text,
  xp_per_unit,
  max_score,
  max_xp,
  status,
  is_enabled
)
VALUES
  (
    'bixsnake',
    'BixSnake',
    'Eat food, grow the snake, and earn XP.',
    '10 XP per food',
    10,
    100,
    1000,
    'active',
    true
  ),
  (
    'bixtap',
    'BixTap',
    'Tap as fast as possible within 10 seconds.',
    '2 XP per tap',
    2,
    300,
    600,
    'active',
    true
  ),
  (
    'bixmemory',
    'BixMemory',
    'Match cards to earn XP rewards.',
    'Coming Soon',
    5,
    100,
    500,
    'coming_soon',
    true
  )
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  reward_rate_text = EXCLUDED.reward_rate_text,
  xp_per_unit = EXCLUDED.xp_per_unit,
  max_score = EXCLUDED.max_score,
  max_xp = EXCLUDED.max_xp,
  status = EXCLUDED.status,
  is_enabled = EXCLUDED.is_enabled,
  updated_at = now();

DROP TRIGGER IF EXISTS update_mini_games_catalog_updated_at ON public.mini_games_catalog;
CREATE TRIGGER update_mini_games_catalog_updated_at
  BEFORE UPDATE ON public.mini_games_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.user_energy (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  energy INTEGER NOT NULL DEFAULT 5,
  last_refill TIMESTAMPTZ NOT NULL DEFAULT now(),
  streak_count INTEGER NOT NULL DEFAULT 0,
  streak_last_date DATE,
  first_game_bonus_date DATE,
  pending_bix NUMERIC(18,8) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_energy_energy_range CHECK (energy BETWEEN 0 AND 5),
  CONSTRAINT user_energy_streak_non_negative CHECK (streak_count >= 0),
  CONSTRAINT user_energy_pending_bix_non_negative CHECK (pending_bix >= 0)
);

DROP TRIGGER IF EXISTS update_user_energy_updated_at ON public.user_energy;
CREATE TRIGGER update_user_energy_updated_at
  BEFORE UPDATE ON public.user_energy
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.mini_game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_slug TEXT NOT NULL REFERENCES public.mini_games_catalog(slug) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'started',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 minutes'),
  submitted_at TIMESTAMPTZ,
  raw_score INTEGER,
  client_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mini_game_sessions_status_valid CHECK (status IN ('started', 'submitted', 'expired', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_mini_game_sessions_user_started
  ON public.mini_game_sessions(user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_mini_game_sessions_user_game_started
  ON public.mini_game_sessions(user_id, game_slug, started_at DESC);

CREATE TABLE IF NOT EXISTS public.mini_game_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID UNIQUE REFERENCES public.mini_game_sessions(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_name TEXT NOT NULL,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  bix_earned NUMERIC(18,8) NOT NULL DEFAULT 0,
  raw_score INTEGER NOT NULL DEFAULT 0,
  base_xp INTEGER NOT NULL DEFAULT 0,
  first_game_bonus_xp INTEGER NOT NULL DEFAULT 0,
  combo_bonus_xp INTEGER NOT NULL DEFAULT 0,
  lucky_bonus_xp INTEGER NOT NULL DEFAULT 0,
  lucky_bonus_bix NUMERIC(18,8) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mini_game_scores_xp_non_negative CHECK (xp_earned >= 0),
  CONSTRAINT mini_game_scores_bix_non_negative CHECK (bix_earned >= 0),
  CONSTRAINT mini_game_scores_raw_non_negative CHECK (raw_score >= 0),
  CONSTRAINT mini_game_scores_bonus_non_negative CHECK (
    base_xp >= 0
    AND first_game_bonus_xp >= 0
    AND combo_bonus_xp >= 0
    AND lucky_bonus_xp >= 0
    AND lucky_bonus_bix >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_mini_game_scores_user_created
  ON public.mini_game_scores(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mini_game_scores_user_game_created
  ON public.mini_game_scores(user_id, game_name, created_at DESC);

ALTER TABLE public.mini_games_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_energy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mini_game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mini_game_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Mini game catalog readable by authenticated users" ON public.mini_games_catalog;
CREATE POLICY "Mini game catalog readable by authenticated users"
  ON public.mini_games_catalog
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage mini game catalog" ON public.mini_games_catalog;
CREATE POLICY "Admins manage mini game catalog"
  ON public.mini_games_catalog
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users view own energy" ON public.user_energy;
CREATE POLICY "Users view own energy"
  ON public.user_energy
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users view own mini game sessions" ON public.mini_game_sessions;
CREATE POLICY "Users view own mini game sessions"
  ON public.mini_game_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users view own mini game scores" ON public.mini_game_scores;
CREATE POLICY "Users view own mini game scores"
  ON public.mini_game_scores
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

REVOKE ALL ON TABLE public.mini_games_catalog FROM anon;
REVOKE ALL ON TABLE public.user_energy FROM anon;
REVOKE ALL ON TABLE public.mini_game_sessions FROM anon;
REVOKE ALL ON TABLE public.mini_game_scores FROM anon;

GRANT SELECT ON TABLE public.mini_games_catalog TO authenticated;
GRANT SELECT ON TABLE public.user_energy TO authenticated;
GRANT SELECT ON TABLE public.mini_game_sessions TO authenticated;
GRANT SELECT ON TABLE public.mini_game_scores TO authenticated;
GRANT ALL ON TABLE public.mini_games_catalog TO service_role;
GRANT ALL ON TABLE public.user_energy TO service_role;
GRANT ALL ON TABLE public.mini_game_sessions TO service_role;
GRANT ALL ON TABLE public.mini_game_scores TO service_role;

CREATE OR REPLACE FUNCTION public.mini_game_ensure_energy_row(p_user_id UUID)
RETURNS public.user_energy
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.user_energy%ROWTYPE;
BEGIN
  INSERT INTO public.user_energy (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
  INTO _row
  FROM public.user_energy
  WHERE user_id = p_user_id;

  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.mini_game_refresh_energy(p_user_id UUID)
RETURNS public.user_energy
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.user_energy%ROWTYPE;
BEGIN
  PERFORM public.mini_game_ensure_energy_row(p_user_id);

  SELECT *
  INTO _row
  FROM public.user_energy
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Energy record not found';
  END IF;

  IF now() >= (_row.last_refill + INTERVAL '24 hours') THEN
    UPDATE public.user_energy
    SET
      energy = 5,
      last_refill = now(),
      updated_at = now()
    WHERE user_id = p_user_id
    RETURNING *
    INTO _row;
  END IF;

  RETURN _row;
END;
$$;

CREATE OR REPLACE FUNCTION public.mini_game_claim_daily_login_bonus()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (now() AT TIME ZONE 'UTC')::date;
  _energy_row public.user_energy%ROWTYPE;
  _next_streak INTEGER;
  _bonus_xp INTEGER := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO _energy_row FROM public.mini_game_refresh_energy(_uid);

  IF _energy_row.streak_last_date = _today THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_claimed', true,
      'streak_count', COALESCE(_energy_row.streak_count, 0),
      'bonus_xp', 0
    );
  END IF;

  IF _energy_row.streak_last_date = (_today - 1) THEN
    _next_streak := LEAST(COALESCE(_energy_row.streak_count, 0) + 1, 7);
  ELSE
    _next_streak := 1;
  END IF;

  _bonus_xp := CASE _next_streak
    WHEN 1 THEN 50
    WHEN 2 THEN 100
    WHEN 3 THEN 150
    WHEN 4 THEN 200
    WHEN 5 THEN 300
    WHEN 6 THEN 400
    ELSE 500
  END;

  UPDATE public.user_energy
  SET
    streak_count = _next_streak,
    streak_last_date = _today,
    updated_at = now()
  WHERE user_id = _uid
  RETURNING *
  INTO _energy_row;

  BEGIN
    PERFORM public.progression_award_xp(_uid, _bonus_xp);
  EXCEPTION
    WHEN undefined_function THEN
      PERFORM public.award_xp(_uid, _bonus_xp);
  END;

  INSERT INTO public.activities (user_id, activity_type, points_earned, description, metadata)
  VALUES (
    _uid,
    'custom',
    _bonus_xp,
    'Mini Games daily login bonus',
    jsonb_build_object(
      'source', 'mini_game_daily_login_bonus',
      'streak_day', _next_streak,
      'bonus_xp', _bonus_xp,
      'unit', 'xp'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_claimed', false,
    'streak_count', _next_streak,
    'bonus_xp', _bonus_xp
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mini_game_start_session(
  p_game_slug TEXT,
  p_client_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (now() AT TIME ZONE 'UTC')::date;
  _slug TEXT := lower(trim(COALESCE(p_game_slug, '')));
  _game public.mini_games_catalog%ROWTYPE;
  _energy_row public.user_energy%ROWTYPE;
  _plays_today INTEGER := 0;
  _session_id UUID;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _slug = '' THEN
    RAISE EXCEPTION 'game_slug is required';
  END IF;

  SELECT *
  INTO _game
  FROM public.mini_games_catalog
  WHERE slug = _slug
    AND is_enabled = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game not found';
  END IF;

  IF _game.status = 'coming_soon' THEN
    RAISE EXCEPTION 'Game is coming soon';
  END IF;

  SELECT * INTO _energy_row FROM public.mini_game_refresh_energy(_uid);

  SELECT COUNT(*)::INTEGER
  INTO _plays_today
  FROM public.mini_game_sessions s
  WHERE s.user_id = _uid
    AND s.game_slug = _slug
    AND (s.started_at AT TIME ZONE 'UTC')::date = _today;

  IF _plays_today >= 5 THEN
    RAISE EXCEPTION 'Daily play limit reached for this game';
  END IF;

  IF _energy_row.energy <= 0 THEN
    RAISE EXCEPTION 'No energy remaining';
  END IF;

  UPDATE public.user_energy
  SET
    energy = energy - 1,
    updated_at = now()
  WHERE user_id = _uid
  RETURNING *
  INTO _energy_row;

  INSERT INTO public.mini_game_sessions (
    user_id,
    game_slug,
    status,
    expires_at,
    client_meta
  )
  VALUES (
    _uid,
    _slug,
    'started',
    now() + INTERVAL '30 minutes',
    COALESCE(p_client_meta, '{}'::jsonb)
  )
  RETURNING id
  INTO _session_id;

  RETURN jsonb_build_object(
    'success', true,
    'session_id', _session_id,
    'game_slug', _slug,
    'game_name', _game.name,
    'status', _game.status,
    'energy_remaining', _energy_row.energy,
    'plays_today', _plays_today + 1,
    'max_plays_per_day', 5,
    'xp_per_unit', _game.xp_per_unit,
    'max_score', _game.max_score,
    'max_xp', _game.max_xp,
    'conversion_rate', '10000 XP = 1 BIX'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mini_game_submit_score(
  p_session_id UUID,
  p_score INTEGER,
  p_client_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (now() AT TIME ZONE 'UTC')::date;
  _session public.mini_game_sessions%ROWTYPE;
  _game public.mini_games_catalog%ROWTYPE;
  _energy_row public.user_energy%ROWTYPE;
  _pending_bix NUMERIC(18,8) := 0;
  _reported_score INTEGER := GREATEST(COALESCE(p_score, 0), 0);
  _normalized_score INTEGER := 0;
  _base_xp INTEGER := 0;
  _first_bonus_xp INTEGER := 0;
  _combo_bonus_xp INTEGER := 0;
  _lucky_bonus_xp INTEGER := 0;
  _lucky_bonus_bix NUMERIC(18,8) := 0;
  _total_xp INTEGER := 0;
  _bix_from_xp NUMERIC(18,8) := 0;
  _total_bix NUMERIC(18,8) := 0;
  _roll DOUBLE PRECISION := random();
  _completed_today INTEGER := 0;
  _new_score_id UUID;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id is required';
  END IF;

  SELECT *
  INTO _session
  FROM public.mini_game_sessions
  WHERE id = p_session_id
    AND user_id = _uid
  FOR UPDATE;

  IF NOT FOUND THEN
    IF EXISTS (
      SELECT 1
      FROM public.mini_game_scores
      WHERE session_id = p_session_id
        AND user_id = _uid
    ) THEN
      RAISE EXCEPTION 'Score already submitted';
    END IF;
    RAISE EXCEPTION 'Invalid game session';
  END IF;

  IF _session.status <> 'started' THEN
    RAISE EXCEPTION 'Score already submitted';
  END IF;

  IF now() > _session.expires_at THEN
    UPDATE public.mini_game_sessions
    SET status = 'expired'
    WHERE id = _session.id;
    RAISE EXCEPTION 'Game session expired';
  END IF;

  SELECT *
  INTO _game
  FROM public.mini_games_catalog
  WHERE slug = _session.game_slug
    AND is_enabled = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game config unavailable';
  END IF;

  _normalized_score := LEAST(_reported_score, _game.max_score);
  _base_xp := LEAST(_normalized_score * _game.xp_per_unit, _game.max_xp);

  SELECT COUNT(*)::INTEGER
  INTO _completed_today
  FROM public.mini_game_scores s
  WHERE s.user_id = _uid
    AND (s.created_at AT TIME ZONE 'UTC')::date = _today;

  IF _completed_today = 0 THEN
    _first_bonus_xp := 100;
  END IF;

  IF (_completed_today + 1) = 3 THEN
    _combo_bonus_xp := 50;
  ELSIF (_completed_today + 1) = 5 THEN
    _combo_bonus_xp := 100;
  END IF;

  IF _roll < 0.80 THEN
    _lucky_bonus_xp := 0;
    _lucky_bonus_bix := 0;
  ELSIF _roll < 0.95 THEN
    _lucky_bonus_xp := 50;
    _lucky_bonus_bix := 0;
  ELSIF _roll < 0.99 THEN
    _lucky_bonus_xp := 200;
    _lucky_bonus_bix := 0;
  ELSE
    _lucky_bonus_xp := 0;
    _lucky_bonus_bix := 0.01;
  END IF;

  _total_xp := _base_xp + _first_bonus_xp + _combo_bonus_xp + _lucky_bonus_xp;
  _bix_from_xp := ROUND((_total_xp::NUMERIC / 10000.0), 8);
  _total_bix := ROUND(_bix_from_xp + _lucky_bonus_bix, 8);

  UPDATE public.mini_game_sessions
  SET
    status = 'submitted',
    submitted_at = now(),
    raw_score = _reported_score,
    client_meta = COALESCE(client_meta, '{}'::jsonb) || COALESCE(p_client_meta, '{}'::jsonb)
  WHERE id = _session.id;

  INSERT INTO public.mini_game_scores (
    session_id,
    user_id,
    game_name,
    xp_earned,
    bix_earned,
    raw_score,
    base_xp,
    first_game_bonus_xp,
    combo_bonus_xp,
    lucky_bonus_xp,
    lucky_bonus_bix
  )
  VALUES (
    _session.id,
    _uid,
    _game.name,
    _total_xp,
    _total_bix,
    _normalized_score,
    _base_xp,
    _first_bonus_xp,
    _combo_bonus_xp,
    _lucky_bonus_xp,
    _lucky_bonus_bix
  )
  RETURNING id
  INTO _new_score_id;

  IF _total_xp > 0 THEN
    BEGIN
      PERFORM public.progression_award_xp(_uid, _total_xp);
    EXCEPTION
      WHEN undefined_function THEN
        PERFORM public.award_xp(_uid, _total_xp);
    END;
  END IF;

  IF _lucky_bonus_bix > 0 THEN
    UPDATE public.user_energy
    SET pending_bix = pending_bix + _lucky_bonus_bix
    WHERE user_id = _uid;
  END IF;

  SELECT *
  INTO _energy_row
  FROM public.user_energy
  WHERE user_id = _uid;

  _pending_bix := COALESCE(_energy_row.pending_bix, 0);

  INSERT INTO public.activities (user_id, activity_type, points_earned, description, metadata)
  VALUES (
    _uid,
    'custom',
    _total_xp,
    _game.name || ' score submitted',
    jsonb_build_object(
      'source', 'mini_games',
      'game_slug', _game.slug,
      'game_name', _game.name,
      'session_id', _session.id,
      'score_id', _new_score_id,
      'raw_score', _normalized_score,
      'base_xp', _base_xp,
      'first_game_bonus_xp', _first_bonus_xp,
      'combo_bonus_xp', _combo_bonus_xp,
      'lucky_bonus_xp', _lucky_bonus_xp,
      'lucky_bonus_bix', _lucky_bonus_bix,
      'bix_from_xp', _bix_from_xp,
      'bix_earned', _total_bix,
      'unit', 'xp'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'session_id', _session.id,
    'score_id', _new_score_id,
    'game_slug', _game.slug,
    'game_name', _game.name,
    'raw_score', _normalized_score,
    'xp_earned', _total_xp,
    'bix_earned', _total_bix,
    'bix_from_xp', _bix_from_xp,
    'energy_remaining', COALESCE(_energy_row.energy, 0),
    'games_played_today', _completed_today + 1,
    'bonuses', jsonb_build_object(
      'first_game_bonus_xp', _first_bonus_xp,
      'combo_bonus_xp', _combo_bonus_xp,
      'lucky_bonus_xp', _lucky_bonus_xp,
      'lucky_bonus_bix', _lucky_bonus_bix
    ),
    'lucky_drop', jsonb_build_object(
      'roll', _roll,
      'xp', _lucky_bonus_xp,
      'bix', _lucky_bonus_bix
    ),
    'pending_bix', _pending_bix
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mini_game_get_overview()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _today DATE := (now() AT TIME ZONE 'UTC')::date;
  _energy_row public.user_energy%ROWTYPE;
  _total_games INTEGER := 0;
  _today_games INTEGER := 0;
  _total_xp INTEGER := 0;
  _total_bix NUMERIC(18,8) := 0;
  _best_scores JSONB := '{}'::jsonb;
  _games JSONB := '[]'::jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO _energy_row FROM public.mini_game_refresh_energy(_uid);

  SELECT
    COALESCE(COUNT(*), 0)::INTEGER,
    COALESCE(SUM(xp_earned), 0)::INTEGER,
    COALESCE(SUM(bix_earned), 0)::NUMERIC(18,8)
  INTO _total_games, _total_xp, _total_bix
  FROM public.mini_game_scores
  WHERE user_id = _uid;

  SELECT COALESCE(COUNT(*), 0)::INTEGER
  INTO _today_games
  FROM public.mini_game_scores
  WHERE user_id = _uid
    AND (created_at AT TIME ZONE 'UTC')::date = _today;

  SELECT COALESCE(
    jsonb_object_agg(game_name, best_score),
    '{}'::jsonb
  )
  INTO _best_scores
  FROM (
    SELECT game_name, MAX(raw_score)::INTEGER AS best_score
    FROM public.mini_game_scores
    WHERE user_id = _uid
    GROUP BY game_name
  ) x;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'slug', g.slug,
        'name', g.name,
        'description', g.description,
        'reward_rate', g.reward_rate_text,
        'status', g.status,
        'xp_per_unit', g.xp_per_unit,
        'max_score', g.max_score,
        'max_xp', g.max_xp,
        'playable', (g.status IN ('active', 'beta') AND g.is_enabled = true)
      )
      ORDER BY CASE g.status WHEN 'active' THEN 0 WHEN 'beta' THEN 1 ELSE 2 END, g.name
    ),
    '[]'::jsonb
  )
  INTO _games
  FROM public.mini_games_catalog g
  WHERE g.is_enabled = true;

  RETURN jsonb_build_object(
    'success', true,
    'conversion_rate', '10000 XP = 1 BIX',
    'energy', COALESCE(_energy_row.energy, 0),
    'max_energy', 5,
    'last_refill', _energy_row.last_refill,
    'streak_count', COALESCE(_energy_row.streak_count, 0),
    'streak_last_date', _energy_row.streak_last_date,
    'today_games_played', _today_games,
    'stats', jsonb_build_object(
      'total_games_played', _total_games,
      'total_xp_from_games', _total_xp,
      'total_bix_earned_from_games', ROUND(_total_bix, 8),
      'best_score_per_game', _best_scores,
      'pending_lucky_bix', COALESCE(_energy_row.pending_bix, 0)
    ),
    'games', _games
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mini_game_get_profile_stats(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid UUID := auth.uid();
  _target UUID := COALESCE(p_user_id, _uid);
  _total_games INTEGER := 0;
  _total_xp INTEGER := 0;
  _total_bix NUMERIC(18,8) := 0;
  _best_scores JSONB := '{}'::jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _target IS NULL THEN
    RAISE EXCEPTION 'target user not found';
  END IF;

  IF _target <> _uid AND NOT public.is_admin(_uid) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT
    COALESCE(COUNT(*), 0)::INTEGER,
    COALESCE(SUM(xp_earned), 0)::INTEGER,
    COALESCE(SUM(bix_earned), 0)::NUMERIC(18,8)
  INTO _total_games, _total_xp, _total_bix
  FROM public.mini_game_scores
  WHERE user_id = _target;

  SELECT COALESCE(
    jsonb_object_agg(game_name, best_score),
    '{}'::jsonb
  )
  INTO _best_scores
  FROM (
    SELECT game_name, MAX(raw_score)::INTEGER AS best_score
    FROM public.mini_game_scores
    WHERE user_id = _target
    GROUP BY game_name
  ) x;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', _target,
    'total_games_played', _total_games,
    'total_xp_from_games', _total_xp,
    'total_bix_earned_from_games', ROUND(_total_bix, 8),
    'best_score_per_game', _best_scores
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mini_game_ensure_energy_row(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mini_game_refresh_energy(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mini_game_claim_daily_login_bonus() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mini_game_start_session(TEXT, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mini_game_submit_score(UUID, INTEGER, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mini_game_get_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mini_game_get_profile_stats(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.mini_game_ensure_energy_row(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mini_game_refresh_energy(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.mini_game_claim_daily_login_bonus() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mini_game_start_session(TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mini_game_submit_score(UUID, INTEGER, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mini_game_get_overview() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mini_game_get_profile_stats(UUID) TO authenticated, service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'mini_game_scores'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.mini_game_scores;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_energy'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_energy;
  END IF;
END;
$$;
