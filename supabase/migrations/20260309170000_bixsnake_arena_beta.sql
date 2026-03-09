-- Promote BixSnake to BixSnake Arena beta configuration.
-- Keeps slug stable so existing start/submit RPC contracts remain intact.

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
VALUES (
  'bixsnake',
  'BixSnake Arena',
  'Snake.io-style arena survival against AI snakes. Collect food, outmaneuver rivals, and earn XP.',
  'Normal 10 XP, Golden 50 XP, Mega 100 XP',
  10,
  900,
  9000,
  'beta',
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

