
-- Fix approve_withdrawal: add admin check
CREATE OR REPLACE FUNCTION public.approve_withdrawal(wid uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  UPDATE withdrawals SET status = 'approved' WHERE id = wid;
  RETURN 'Approved';
END;
$$;

-- Fix reject_withdrawal: add admin check
CREATE OR REPLACE FUNCTION public.reject_withdrawal(wid uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  uid uuid;
  amt numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  SELECT user_id, amount INTO uid, amt FROM withdrawals WHERE id = wid;
  UPDATE users SET bix_balance = bix_balance + amt WHERE id = uid;
  UPDATE withdrawals SET status = 'rejected' WHERE id = wid;
  RETURN 'Rejected';
END;
$$;
