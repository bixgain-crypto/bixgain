
-- Attach the trigger to the users table (was missing)
DROP TRIGGER IF EXISTS trg_auto_recalc_level ON public.users;

CREATE TRIGGER trg_auto_recalc_level
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_recalc_level_on_xp_change();

-- One-time backfill: fix any existing mismatches right now
UPDATE public.users
SET
  current_level = CASE
    WHEN total_xp >= 70000 THEN 5
    WHEN total_xp >= 35000 THEN 4
    WHEN total_xp >= 15000 THEN 3
    WHEN total_xp >= 5000  THEN 2
    ELSE 1
  END,
  level = CASE
    WHEN total_xp >= 70000 THEN 5
    WHEN total_xp >= 35000 THEN 4
    WHEN total_xp >= 15000 THEN 3
    WHEN total_xp >= 5000  THEN 2
    ELSE 1
  END,
  level_name = CASE
    WHEN total_xp >= 70000 THEN 'Legend'
    WHEN total_xp >= 35000 THEN 'Elite'
    WHEN total_xp >= 15000 THEN 'Pro'
    WHEN total_xp >= 5000  THEN 'Builder'
    ELSE 'Explorer'
  END
WHERE
  current_level <> CASE
    WHEN total_xp >= 70000 THEN 5
    WHEN total_xp >= 35000 THEN 4
    WHEN total_xp >= 15000 THEN 3
    WHEN total_xp >= 5000  THEN 2
    ELSE 1
  END
  OR level_name <> CASE
    WHEN total_xp >= 70000 THEN 'Legend'
    WHEN total_xp >= 35000 THEN 'Elite'
    WHEN total_xp >= 15000 THEN 'Pro'
    WHEN total_xp >= 5000  THEN 'Builder'
    ELSE 'Explorer'
  END;
