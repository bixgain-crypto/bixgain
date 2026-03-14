
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

  IF NEW.total_xp IS DISTINCT FROM OLD.total_xp THEN

    IF COALESCE(NEW.total_xp, 0) > _old_total_xp THEN
      _delta := COALESCE(NEW.total_xp, 0)::bigint - _old_total_xp;
      IF NEW.total_xp_earned IS NOT DISTINCT FROM OLD.total_xp_earned THEN
        NEW.total_xp_earned := _old_total_xp_earned + _delta;
      END IF;
    ELSE
      IF NEW.total_xp_earned IS NULL THEN
        NEW.total_xp_earned := _old_total_xp_earned;
      END IF;
    END IF;

    _new_level := CASE
      WHEN COALESCE(NEW.total_xp, 0) >= 500000 THEN 10
      WHEN COALESCE(NEW.total_xp, 0) >= 360000 THEN 9
      WHEN COALESCE(NEW.total_xp, 0) >= 265000 THEN 8
      WHEN COALESCE(NEW.total_xp, 0) >= 185000 THEN 7
      WHEN COALESCE(NEW.total_xp, 0) >= 120000 THEN 6
      WHEN COALESCE(NEW.total_xp, 0) >= 70000  THEN 5
      WHEN COALESCE(NEW.total_xp, 0) >= 35000  THEN 4
      WHEN COALESCE(NEW.total_xp, 0) >= 15000  THEN 3
      WHEN COALESCE(NEW.total_xp, 0) >= 5000   THEN 2
      ELSE 1
    END;

    _new_level_name := CASE _new_level
      WHEN 1  THEN 'Explorer'
      WHEN 2  THEN 'Builder'
      WHEN 3  THEN 'Pro'
      WHEN 4  THEN 'Elite'
      WHEN 5  THEN 'Legend'
      WHEN 6  THEN 'Master'
      WHEN 7  THEN 'Grandmaster'
      WHEN 8  THEN 'Mythic'
      WHEN 9  THEN 'Immortal'
      WHEN 10 THEN 'Apex'
      ELSE 'Explorer'
    END;

    NEW.current_level := _new_level;
    NEW.level := _new_level;
    NEW.level_name := _new_level_name;
  END IF;

  RETURN NEW;
END;
$function$;
