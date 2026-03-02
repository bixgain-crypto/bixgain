
-- Fix remaining functions without search_path

CREATE OR REPLACE FUNCTION public.create_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_username()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
begin
  update users
  set username = 'user_' || substring(new.id::text,1,8)
  where id = new.id and username is null;
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
begin
  insert into public.users (id, created_at, bix_balance, total_bix, total_xp, converted_xp, current_level, level_name, username, xp)
  values (new.id, now(), 0, 0, 0, 0, 1, 'Explorer', 'User_' || substring(new.id::text,1,6), 0);
  return new;
end;
$$;
