
-- Fix mutable search_path on functions that don't have it set

-- is_admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path = public
AS $$
  select exists (
    select 1
    from public.users
    where id = _user_id
      and is_admin = true
  );
$$;

-- approve_withdrawal
CREATE OR REPLACE FUNCTION public.approve_withdrawal(wid uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
begin
  update withdrawals
  set status = 'approved'
  where id = wid;
  return 'Approved';
end;
$$;

-- reject_withdrawal
CREATE OR REPLACE FUNCTION public.reject_withdrawal(wid uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
declare
  uid uuid;
  amt numeric;
begin
  select user_id, amount into uid, amt
  from withdrawals where id = wid;

  update users
  set bix_balance = bix_balance + amt
  where id = uid;

  update withdrawals
  set status = 'rejected'
  where id = wid;

  return 'Rejected';
end;
$$;

-- convert_xp_to_bix
CREATE OR REPLACE FUNCTION public.convert_xp_to_bix(user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
DECLARE
  convertible INTEGER;
  new_bix INTEGER;
  already_converted INTEGER;
BEGIN
  SELECT FLOOR(total_xp / 10000), converted_xp / 10000
  INTO convertible, already_converted
  FROM public.users WHERE id = user_id;

  new_bix := convertible - already_converted;

  IF new_bix > 0 THEN
    UPDATE public.users
    SET bix_balance = bix_balance + new_bix,
        total_bix = total_bix + new_bix,
        converted_xp = converted_xp + (new_bix * 10000)
    WHERE id = user_id;
  END IF;
END;
$$;

-- award_xp
CREATE OR REPLACE FUNCTION public.award_xp(user_id uuid, xp_amount integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
BEGIN
  IF xp_amount <= 0 THEN RETURN; END IF;
  UPDATE public.users SET total_xp = total_xp + xp_amount WHERE id = user_id;
  PERFORM convert_xp_to_bix(user_id);
END;
$$;

-- admin_update_setting
CREATE OR REPLACE FUNCTION public.admin_update_setting(p_key text, p_value text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
begin
  update platform_settings
  set value = p_value, updated_at = now()
  where key = p_key;
end;
$$;

-- admin_grant_xp
CREATE OR REPLACE FUNCTION public.admin_grant_xp(p_user uuid, p_xp integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
begin
  update users set total_xp = total_xp + p_xp where id = p_user;
end;
$$;

-- admin_grant_bix
CREATE OR REPLACE FUNCTION public.admin_grant_bix(p_user uuid, p_bix integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
begin
  update users
  set bix_balance = bix_balance + p_bix, total_bix = total_bix + p_bix
  where id = p_user;
end;
$$;

-- change_username
CREATE OR REPLACE FUNCTION public.change_username(new_username text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
declare
  last_change timestamp;
  name_exists integer;
begin
  if length(new_username) < 3 then return 'Username too short (min 3)'; end if;
  if length(new_username) > 20 then return 'Username too long (max 20)'; end if;
  if new_username !~ '^[A-Za-z0-9]+$' then return 'Only letters and numbers allowed'; end if;
  if lower(new_username) in ('admin','root','moderator','support','staff','owner') then return 'Username not allowed'; end if;

  select count(*) into name_exists from users where lower(username) = lower(new_username);
  if name_exists > 0 then return 'Username already taken'; end if;

  select last_username_change into last_change from users where id = auth.uid();
  if last_change is not null and last_change > now() - interval '30 days' then
    return 'Username can only be changed once every 30 days';
  end if;

  update users set username = new_username, last_username_change = now() where id = auth.uid();
  return 'Username updated successfully';
end;
$$;

-- stake_tokens
CREATE OR REPLACE FUNCTION public.stake_tokens(p_user_id uuid, p_plan_id uuid, p_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path = public
AS $$
DECLARE
    v_plan RECORD;
    v_wallet RECORD;
    v_control RECORD;
BEGIN
    SELECT * INTO v_plan FROM staking_plans WHERE id = p_plan_id FOR UPDATE;
    IF NOT v_plan.is_active THEN RAISE EXCEPTION 'Staking plan is not active'; END IF;
    IF p_amount < v_plan.min_amount OR p_amount > v_plan.max_amount THEN RAISE EXCEPTION 'Amount outside allowed range'; END IF;

    SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id FOR UPDATE;
    IF v_wallet.balance < p_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

    SELECT * INTO v_control FROM staking_control LIMIT 1 FOR UPDATE;
    IF NOT v_control.is_staking_enabled THEN RAISE EXCEPTION 'Staking is disabled'; END IF;
    IF v_plan.max_total_pool IS NOT NULL AND v_plan.current_total_staked + p_amount > v_plan.max_total_pool THEN RAISE EXCEPTION 'Plan pool limit reached'; END IF;
    IF v_control.total_platform_staked + p_amount > v_control.max_platform_staking THEN RAISE EXCEPTION 'Platform staking limit reached'; END IF;

    UPDATE wallets SET balance = balance - p_amount, locked_balance = locked_balance + p_amount WHERE user_id = p_user_id;

    INSERT INTO stakes (user_id, plan_id, amount, start_date, end_date, is_active)
    VALUES (p_user_id, p_plan_id, p_amount, now(), now() + (v_plan.duration_days || ' days')::interval, true);

    UPDATE staking_plans SET current_total_staked = current_total_staked + p_amount, total_active_stakers = total_active_stakers + 1 WHERE id = p_plan_id;
    UPDATE staking_control SET total_platform_staked = total_platform_staked + p_amount;
END;
$$;

-- update_profile
CREATE OR REPLACE FUNCTION public.update_profile(new_display text, new_bio text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
begin
  update users set display_name = new_display, bio = new_bio where id = auth.uid();
  return 'Profile updated';
end;
$$;

-- spend_bix (2-arg version)
CREATE OR REPLACE FUNCTION public.spend_bix(p_user_id uuid, p_amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
begin
  if (select bix_balance from users where id = p_user_id) < p_amount then
    raise exception 'Insufficient balance';
  end if;
  update users set bix_balance = bix_balance - p_amount where id = p_user_id;
  insert into reward_transactions(user_id, amount, type) values (p_user_id, -p_amount, 'spend');
end;
$$;

-- spend_bix (auth.uid version)
CREATE OR REPLACE FUNCTION public.spend_bix(p_amount numeric, p_description text DEFAULT 'Store purchase'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
declare
  v_user_id uuid;
  v_current_balance numeric;
  v_new_balance numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  select bix_balance into v_current_balance from users where id = v_user_id for update;
  if v_current_balance < p_amount then raise exception 'Insufficient balance'; end if;

  v_new_balance := v_current_balance - p_amount;
  update users set bix_balance = v_new_balance where id = v_user_id;

  insert into reward_transactions (user_id, transaction_type, gross_amount, tax_amount, net_amount, running_balance, description)
  values (v_user_id, 'spend', p_amount, 0, -p_amount, v_new_balance, p_description);
end;
$$;

-- update_badge
CREATE OR REPLACE FUNCTION public.update_badge()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
begin
  update users set
    badge_icon = case
      when current_level = 1 then '🟢' when current_level = 2 then '🔵'
      when current_level = 3 then '🟣' when current_level = 4 then '🟠' else '🔴' end,
    badge_color = case
      when current_level = 1 then 'green' when current_level = 2 then 'blue'
      when current_level = 3 then 'purple' when current_level = 4 then 'orange' else 'red' end,
    badge_title = level_name
  where id = auth.uid();
end;
$$;

-- update_streak
CREATE OR REPLACE FUNCTION public.update_streak()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
declare
  last_date date;
  today_date date;
begin
  today_date := current_date;
  select last_active_date into last_date from users where id = auth.uid();

  if last_date is null then
    update users set streak_count = 1, last_active_date = today_date, longest_streak = 1 where id = auth.uid();
    return 'Streak started';
  end if;
  if last_date = today_date then return 'Already counted today'; end if;
  if last_date = today_date - 1 then
    update users set streak_count = streak_count + 1, last_active_date = today_date,
      longest_streak = greatest(longest_streak, streak_count + 1) where id = auth.uid();
    return 'Streak increased';
  end if;

  update users set streak_count = 1, last_active_date = today_date where id = auth.uid();
  return 'Streak restarted';
end;
$$;

-- get_active_season
CREATE OR REPLACE FUNCTION public.get_active_season()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
declare season_id uuid;
begin
  select id into season_id from seasons where is_active = true limit 1;
  return season_id;
end;
$$;

-- reset_season
CREATE OR REPLACE FUNCTION public.reset_season()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
begin
  update users set season_xp = 0;
  update seasons set is_active = false where is_active = true;
  insert into seasons (name, start_date, end_date, is_active) values ('New Season', now(), now() + interval '30 days', true);
  return 'Season reset completed';
end;
$$;

-- reset_weekly
CREATE OR REPLACE FUNCTION public.reset_weekly()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
begin
  update users set weekly_xp = 0;
  return 'Weekly reset completed';
end;
$$;

-- complete_mission
CREATE OR REPLACE FUNCTION public.complete_mission(mission_uuid uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
declare xp_value integer;
begin
  select xp_reward into xp_value from missions where id = mission_uuid;

  if exists(select 1 from user_missions where user_id = auth.uid() and mission_id = mission_uuid and completed_at > now() - interval '24 hours') then
    return 'Mission already completed';
  end if;

  insert into user_missions(user_id, mission_id, completed_at) values(auth.uid(), mission_uuid, now());
  update users set total_xp = total_xp + xp_value, season_xp = season_xp + xp_value, weekly_xp = weekly_xp + xp_value where id = auth.uid();
  return 'Mission completed';
end;
$$;

-- check_achievements
CREATE OR REPLACE FUNCTION public.check_achievements()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
declare
  ach record;
  user_xp integer;
begin
  select total_xp into user_xp from users where id = auth.uid();

  for ach in select * from achievements where condition_type = 'xp_total' loop
    if user_xp >= ach.condition_value and not exists(
      select 1 from user_achievements where user_id = auth.uid() and achievement_id = ach.id
    ) then
      insert into user_achievements(user_id, achievement_id) values(auth.uid(), ach.id);
      update users set total_xp = total_xp + ach.xp_reward where id = auth.uid();
    end if;
  end loop;

  return 'Achievements checked';
end;
$$;

-- activate_boost
CREATE OR REPLACE FUNCTION public.activate_boost(multiplier numeric, hours integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
begin
  update users set xp_multiplier = multiplier, boost_expires_at = now() + (hours || ' hours')::interval where id = auth.uid();
  return 'Boost activated';
end;
$$;

-- expire_boosts
CREATE OR REPLACE FUNCTION public.expire_boosts()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
begin
  update users set xp_multiplier = 1.0, boost_expires_at = null where boost_expires_at < now();
  return 'Boosts expired';
end;
$$;

-- request_withdrawal
CREATE OR REPLACE FUNCTION public.request_withdrawal(withdraw_amount numeric, wallet text, net text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $$
declare
  uid uuid := auth.uid();
  balance numeric;
begin
  if uid is null then return 'Not logged in'; end if;

  select bix_balance into balance from users where id = uid;
  if balance < withdraw_amount then return 'Insufficient balance'; end if;
  if withdraw_amount < 100 then return 'Minimum withdrawal is 100 BIX'; end if;

  update users set bix_balance = bix_balance - withdraw_amount where id = uid;
  insert into withdrawals(user_id, amount, wallet_address, network) values(uid, withdraw_amount, wallet, net);
  return 'Withdrawal requested';
end;
$$;

-- sanitize_platform_username
CREATE OR REPLACE FUNCTION public.sanitize_platform_username(p_input text, p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path = public
AS $$
DECLARE _value TEXT;
BEGIN
  _value := lower(COALESCE(p_input, ''));
  _value := regexp_replace(_value, '[^a-z0-9]+', '', 'g');
  IF length(_value) < 3 THEN _value := 'user' || substr(replace(p_user_id::text, '-', ''), 1, 10); END IF;
  IF _value !~ '^[a-z]' THEN _value := 'u' || _value; END IF;
  RETURN substr(_value, 1, 20);
END;
$$;
