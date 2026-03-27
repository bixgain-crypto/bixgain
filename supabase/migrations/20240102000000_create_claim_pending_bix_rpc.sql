CREATE OR REPLACE FUNCTION public.claim_pending_bix(p_user_id uuid)
RETURNS TABLE (
    claimed_amount numeric,
    new_bix_balance numeric,
    new_pending_bix numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    _claimed_amount numeric := 0;
    _current_pending_bix numeric := 0;
    _current_bix_balance numeric := 0;
    _new_bix_balance numeric := 0;
    _new_pending_bix numeric := 0;
BEGIN
    -- Get current pending BIX and main BIX balance
    SELECT pending_bix, bix_balance INTO _current_pending_bix, _current_bix_balance
    FROM public.user_energy
    WHERE user_id = p_user_id;

    -- If no pending BIX, return 0
    IF _current_pending_bix IS NULL OR _current_pending_bix <= 0 THEN
        RETURN QUERY SELECT 0, _current_bix_balance, _current_pending_bix;
        RETURN;
    END IF;

    _claimed_amount := _current_pending_bix;
    _new_bix_balance := _current_bix_balance + _claimed_amount;
    _new_pending_bix := 0;

    -- Update user's main BIX balance
    UPDATE public.users
    SET bix_balance = _new_bix_balance,
        total_bix = total_bix + _claimed_amount -- Also update total_bix
    WHERE id = p_user_id;

    -- Reset pending BIX
    UPDATE public.user_energy
    SET pending_bix = _new_pending_bix
    WHERE user_id = p_user_id;

    -- Insert a transaction record
    INSERT INTO public.reward_transactions (
        user_id,
        transaction_type,
        gross_amount,
        tax_amount,
        net_amount,
        running_balance,
        description,
        metadata
    ) VALUES (
        p_user_id,
        'claim_pending_bix',
        _claimed_amount,
        0,
        _claimed_amount,
        _new_bix_balance,
        'Claimed pending BIX from mini-games',
        jsonb_build_object('source', 'claim_pending_bix_rpc')
    );

    RETURN QUERY SELECT _claimed_amount, _new_bix_balance, _new_pending_bix;
END;
$$;

-- Grant usage to authenticated users
GRANT EXECUTE ON FUNCTION public.claim_pending_bix(uuid) TO authenticated;