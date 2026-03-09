
-- Ensure lifetime XP earned always stays accurate when total_xp increases.
-- We extend the existing level-sync trigger function so ANY XP award path updates total_xp_earned,
-- while XP spending (decreases) never reduces total_xp_earned.

CREATE OR REPLACE FUNCTION public.auto_recalc_level_on_xp_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _new_level integer;
  _new_level_name text;
  _delta bigint;
  _old_total_xp bigint;
  _old_total_xp_earned bigint;
BEGIN
  _old_total_xp := COALESCE(OLD.total_xp, 0);
  _old_total_xp_earned := COALESCE(OLD.total_xp_earned, OLD.total_xp, 0);

  -- Only recalculate if total_xp actually changed
  IF NEW.total_xp IS DISTINCT FROM OLD.total_xp THEN

    -- Keep lifetime XP earned consistent for ANY award path that updates total_xp
    -- but does not explicitly update total_xp_earned.
    IF COALESCE(NEW.total_xp, 0) > _old_total_xp THEN
      _delta := COALESCE(NEW.total_xp, 0)::bigint - _old_total_xp;

      -- If the update statement already touched total_xp_earned, we trust it.
      IF NEW.total_xp_earned IS NOT DISTINCT FROM OLD.total_xp_earned THEN
        NEW.total_xp_earned := _old_total_xp_earned + _delta;
      END IF;
    ELSE
      -- Spending XP: never decrease lifetime earned XP.
      IF NEW.total_xp_earned IS NULL THEN
        NEW.total_xp_earned := _old_total_xp_earned;
      END IF;
    END IF;

    -- Level thresholds (authoritative)
    _new_level := CASE
      WHEN COALESCE(NEW.total_xp, 0) >= 70000 THEN 5
      WHEN COALESCE(NEW.total_xp, 0) >= 35000 THEN 4
      WHEN COALESCE(NEW.total_xp, 0) >= 15000 THEN 3
      WHEN COALESCE(NEW.total_xp, 0) >= 5000  THEN 2
      ELSE 1
    END;

    _new_level_name := CASE _new_level
      WHEN 5 THEN 'Legend'
      WHEN 4 THEN 'Elite'
      WHEN 3 THEN 'Pro'
      WHEN 2 THEN 'Builder'
      ELSE 'Explorer'
    END;

    NEW.current_level := _new_level;
    NEW.level := _new_level;
    NEW.level_name := _new_level_name;
  END IF;

  RETURN NEW;
END;
$function$;
