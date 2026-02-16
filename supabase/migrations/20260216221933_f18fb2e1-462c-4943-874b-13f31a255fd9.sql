
-- Trigger to update wallet balance when an activity is inserted
CREATE OR REPLACE FUNCTION public.credit_wallet_on_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.wallets
  SET balance = balance + NEW.points_earned,
      updated_at = now()
  WHERE user_id = NEW.user_id
    AND wallet_type = 'bix'
    AND is_primary = true;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_credit_wallet_on_activity
AFTER INSERT ON public.activities
FOR EACH ROW
EXECUTE FUNCTION public.credit_wallet_on_activity();

-- Trigger to update wallet balance when a spin is recorded
CREATE OR REPLACE FUNCTION public.credit_wallet_on_spin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.wallets
  SET balance = balance + NEW.reward_amount,
      updated_at = now()
  WHERE user_id = NEW.user_id
    AND wallet_type = 'bix'
    AND is_primary = true;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_credit_wallet_on_spin
AFTER INSERT ON public.spin_records
FOR EACH ROW
EXECUTE FUNCTION public.credit_wallet_on_spin();
