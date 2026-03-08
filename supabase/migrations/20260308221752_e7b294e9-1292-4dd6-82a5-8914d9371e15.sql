
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false;

-- Sync existing data from profiles
UPDATE public.users u
SET is_active = COALESCE(p.is_active, true),
    is_frozen = COALESCE(p.is_frozen, false)
FROM public.profiles p
WHERE p.user_id = u.id;

-- Create trigger to keep users.is_active/is_frozen in sync when profiles change
CREATE OR REPLACE FUNCTION public.sync_profile_status_to_users()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.users
  SET is_active = NEW.is_active,
      is_frozen = NEW.is_frozen
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_status ON public.profiles;
CREATE TRIGGER trg_sync_profile_status
  AFTER INSERT OR UPDATE OF is_active, is_frozen ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_status_to_users();
