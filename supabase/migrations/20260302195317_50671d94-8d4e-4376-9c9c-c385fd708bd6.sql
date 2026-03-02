-- Fix 1: Remove overly permissive public SELECT policies on users table
DROP POLICY IF EXISTS "Public leaderboard read" ON public.users;
DROP POLICY IF EXISTS "Public leaderboard view" ON public.users;

-- Fix 2: Create server-side RPC for claim creation
CREATE OR REPLACE FUNCTION public.create_claim(
  p_amount NUMERIC,
  p_wallet_id UUID
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id UUID;
  _wallet RECORD;
  _tax_amount NUMERIC;
  _net_amount NUMERIC;
  _claim_record public.claims%ROWTYPE;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate amount
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;

  -- Verify wallet ownership and get balance
  SELECT * INTO _wallet
  FROM wallets
  WHERE id = p_wallet_id AND user_id = _user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid wallet';
  END IF;

  IF _wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Check open fraud flags
  IF EXISTS (
    SELECT 1 FROM fraud_flags
    WHERE user_id = _user_id AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Account flagged for review';
  END IF;

  -- Calculate tax
  _tax_amount := p_amount * 0.05;
  _net_amount := p_amount - _tax_amount;

  -- Insert claim
  INSERT INTO claims (
    user_id, amount, tax_amount, net_amount, wallet_id, status
  ) VALUES (
    _user_id,
    p_amount,
    _tax_amount,
    _net_amount,
    p_wallet_id,
    'pending'
  ) RETURNING * INTO _claim_record;

  RETURN jsonb_build_object(
    'success', true,
    'claim_id', _claim_record.id,
    'amount', _claim_record.amount,
    'tax_amount', _claim_record.tax_amount,
    'net_amount', _claim_record.net_amount,
    'status', _claim_record.status
  );
END;
$$;

-- Remove direct INSERT policy for claims (keep admin access)
DROP POLICY IF EXISTS "Users create claims" ON public.claims;

-- Fix 3: Recreate leaderboard_view with security_invoker
DROP VIEW IF EXISTS public.leaderboard_view;
CREATE VIEW public.leaderboard_view
WITH (security_invoker=on) AS
  SELECT id, username, bix_balance, total_xp
  FROM public.users;