CREATE OR REPLACE FUNCTION public.activate_boost(multiplier numeric, hours integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  UPDATE users
  SET xp_multiplier = multiplier,
      boost_expires_at = now() + (hours || ' hours')::interval
  WHERE id = auth.uid();
  RETURN 'Boost activated';
END;
$$;