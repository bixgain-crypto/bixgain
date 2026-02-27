-- Unify BIX balance source of truth on public.users (bix_balance).
-- Wallet rows remain available for address/claim compatibility and are mirrored
-- from users.bix_balance.

-- 1) Stop generic activity/spin trigger-based wallet credits.
DROP TRIGGER IF EXISTS trg_credit_wallet_on_activity ON public.activities;
DROP TRIGGER IF EXISTS trg_credit_wallet_on_spin ON public.spin_records;

-- 2) Mirror users.bix_balance into primary BIX wallet for compatibility.
CREATE OR REPLACE FUNCTION public.sync_primary_wallet_from_user_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wallets (user_id, wallet_type, is_primary, balance, updated_at)
  VALUES (NEW.id, 'bix', true, COALESCE(NEW.bix_balance, 0), now())
  ON CONFLICT (user_id, wallet_type)
  DO UPDATE
  SET
    balance = EXCLUDED.balance,
    is_primary = true,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_primary_wallet_from_user_balance ON public.users;
CREATE TRIGGER trg_sync_primary_wallet_from_user_balance
AFTER INSERT OR UPDATE OF bix_balance ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_primary_wallet_from_user_balance();

-- 3) Backfill wallet balances to match users.
UPDATE public.wallets w
SET
  balance = COALESCE(u.bix_balance, 0),
  is_primary = true,
  updated_at = now()
FROM public.users u
WHERE w.user_id = u.id
  AND w.wallet_type = 'bix'
  AND (
    COALESCE(w.balance, -1) <> COALESCE(u.bix_balance, -1)
    OR COALESCE(w.is_primary, false) = false
  );

-- 4) Ensure every user has a BIX wallet row.
INSERT INTO public.wallets (user_id, wallet_type, is_primary, balance)
SELECT u.id, 'bix', true, COALESCE(u.bix_balance, 0)
FROM public.users u
WHERE NOT EXISTS (
  SELECT 1
  FROM public.wallets w
  WHERE w.user_id = u.id
    AND w.wallet_type = 'bix'
);
