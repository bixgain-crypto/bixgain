-- Plumber Puzzle Game
-- Tables for plumber puzzle sessions and scores

CREATE TABLE IF NOT EXISTS public.plumber_puzzle_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level INTEGER NOT NULL,
  grid_size INTEGER NOT NULL,
  moves INTEGER NOT NULL DEFAULT 0,
  time_elapsed INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT plumber_puzzle_sessions_level_positive CHECK (level > 0),
  CONSTRAINT plumber_puzzle_sessions_grid_size_positive CHECK (grid_size > 0),
  CONSTRAINT plumber_puzzle_sessions_moves_non_negative CHECK (moves >= 0),
  CONSTRAINT plumber_puzzle_sessions_time_non_negative CHECK (time_elapsed >= 0),
  CONSTRAINT plumber_puzzle_sessions_score_non_negative CHECK (score >= 0)
);

CREATE INDEX IF NOT EXISTS idx_plumber_puzzle_sessions_user_created
  ON public.plumber_puzzle_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plumber_puzzle_sessions_user_level
  ON public.plumber_puzzle_sessions(user_id, level);

ALTER TABLE public.plumber_puzzle_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own plumber puzzle sessions" ON public.plumber_puzzle_sessions;
CREATE POLICY "Users view own plumber puzzle sessions"
  ON public.plumber_puzzle_sessions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own plumber puzzle sessions" ON public.plumber_puzzle_sessions;
CREATE POLICY "Users insert own plumber puzzle sessions"
  ON public.plumber_puzzle_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());