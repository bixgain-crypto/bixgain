-- Ensure auto-created users rows always satisfy username_format constraints.

CREATE OR REPLACE FUNCTION public.sanitize_platform_username(p_input TEXT, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  _value TEXT;
BEGIN
  _value := lower(COALESCE(p_input, ''));
  _value := regexp_replace(_value, '[^a-z0-9]+', '', 'g');

  IF length(_value) < 3 THEN
    _value := 'user' || substr(replace(p_user_id::text, '-', ''), 1, 10);
  END IF;

  IF _value !~ '^[a-z]' THEN
    _value := 'u' || _value;
  END IF;

  RETURN substr(_value, 1, 20);
END;
$$;

CREATE OR REPLACE FUNCTION public.users_username_autofill_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.username := public.sanitize_platform_username(NEW.username, NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_username_autofill_guard ON public.users;
CREATE TRIGGER trg_users_username_autofill_guard
BEFORE INSERT OR UPDATE OF username ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.users_username_autofill_guard();

CREATE OR REPLACE FUNCTION public.progression_ensure_user_row(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _meta JSONB;
  _email TEXT;
  _candidate TEXT;
  _username TEXT;
BEGIN
  SELECT au.raw_user_meta_data, au.email
  INTO _meta, _email
  FROM auth.users au
  WHERE au.id = p_user_id;

  _candidate := COALESCE(
    NULLIF(TRIM(_meta->>'username'), ''),
    NULLIF(TRIM(_meta->>'display_name'), ''),
    NULLIF(TRIM(split_part(COALESCE(_email, ''), '@', 1)), ''),
    'user' || substr(replace(p_user_id::text, '-', ''), 1, 10)
  );

  _username := public.sanitize_platform_username(_candidate, p_user_id);

  INSERT INTO public.users (id, username)
  VALUES (p_user_id, _username)
  ON CONFLICT (id) DO UPDATE
  SET username = COALESCE(NULLIF(public.users.username, ''), EXCLUDED.username);
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_progression_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _candidate TEXT;
  _username TEXT;
BEGIN
  _candidate := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(TRIM(split_part(COALESCE(NEW.email, ''), '@', 1)), ''),
    'user' || substr(replace(NEW.id::text, '-', ''), 1, 10)
  );
  _username := public.sanitize_platform_username(_candidate, NEW.id);

  INSERT INTO public.users (id, username)
  VALUES (NEW.id, _username)
  ON CONFLICT (id) DO UPDATE
  SET username = COALESCE(NULLIF(public.users.username, ''), EXCLUDED.username);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_progression ON auth.users;
CREATE TRIGGER on_auth_user_created_progression
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_progression_user();

REVOKE ALL ON FUNCTION public.progression_ensure_user_row(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.progression_ensure_user_row(UUID) TO service_role;
