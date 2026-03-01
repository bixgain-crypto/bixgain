
-- ============================================================
-- 1. Enable RLS on all 6 unprotected public tables
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Add RLS policies for tables that lack them
-- ============================================================

-- seasons: public read, admin write
CREATE POLICY "Anyone can view seasons"
  ON public.seasons FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage seasons"
  ON public.seasons FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- missions: public read, admin write
CREATE POLICY "Anyone can view active missions"
  ON public.missions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage missions"
  ON public.missions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- achievements: public read, admin write
CREATE POLICY "Anyone can view achievements"
  ON public.achievements FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage achievements"
  ON public.achievements FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- user_achievements: users see own, admins see all
CREATE POLICY "Users view own achievements"
  ON public.user_achievements FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "System insert user achievements"
  ON public.user_achievements FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage user achievements"
  ON public.user_achievements FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- user_missions: users see own, admins see all
CREATE POLICY "Users view own missions"
  ON public.user_missions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "Users insert own missions"
  ON public.user_missions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage user missions"
  ON public.user_missions FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================
-- 3. Recreate leaderboard views with SECURITY INVOKER
-- ============================================================
DROP VIEW IF EXISTS public.leaderboard_total;
CREATE VIEW public.leaderboard_total
  WITH (security_invoker = on)
AS
  SELECT username,
    display_name,
    total_xp,
    current_level,
    rank() OVER (ORDER BY total_xp DESC) AS rank
  FROM public.users;

DROP VIEW IF EXISTS public.leaderboard_season;
CREATE VIEW public.leaderboard_season
  WITH (security_invoker = on)
AS
  SELECT username,
    display_name,
    season_xp,
    rank() OVER (ORDER BY season_xp DESC) AS rank
  FROM public.users;

DROP VIEW IF EXISTS public.leaderboard_weekly;
CREATE VIEW public.leaderboard_weekly
  WITH (security_invoker = on)
AS
  SELECT username,
    display_name,
    weekly_xp,
    rank() OVER (ORDER BY weekly_xp DESC) AS rank
  FROM public.users;
