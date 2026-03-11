
-- Fix admin views: recreate with security_invoker = on so underlying table RLS applies
-- First get the view definitions, then recreate with security_invoker

-- Drop and recreate v_admin_claims_overview with security_invoker
DROP VIEW IF EXISTS public.v_admin_claims_overview;
CREATE VIEW public.v_admin_claims_overview
WITH (security_invoker = on)
AS
SELECT
  c.id,
  u.username AS user_name,
  c.amount,
  c.tax_amount,
  c.net_amount,
  c.status,
  c.approved_at,
  c.created_at,
  w.address AS wallet_address,
  w.wallet_type
FROM public.claims c
LEFT JOIN public.users u ON c.user_id = u.id
LEFT JOIN public.wallets w ON c.wallet_id = w.id;

-- Drop and recreate v_admin_user_summary with security_invoker
DROP VIEW IF EXISTS public.v_admin_user_summary;
CREATE VIEW public.v_admin_user_summary
WITH (security_invoker = on)
AS
SELECT
  p.id,
  p.user_id,
  p.display_name,
  p.is_active,
  p.is_frozen,
  p.created_at,
  u.bix_balance,
  COALESCE(w.pending_balance, 0) AS pending_balance,
  COALESCE(act_count.total_activities, 0) AS total_activities,
  COALESCE(claim_count.total_claims, 0) AS total_claims,
  COALESCE(fraud_count.open_fraud_flags, 0) AS open_fraud_flags
FROM public.profiles p
LEFT JOIN public.users u ON p.user_id = u.id
LEFT JOIN public.wallets w ON w.user_id = p.user_id AND w.is_primary = true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::bigint AS total_activities
  FROM public.activities a WHERE a.user_id = p.user_id
) act_count ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::bigint AS total_claims
  FROM public.claims cl WHERE cl.user_id = p.user_id
) claim_count ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*)::bigint AS open_fraud_flags
  FROM public.fraud_flags ff WHERE ff.user_id = p.user_id AND ff.status = 'open'
) fraud_count ON true;

-- Grant SELECT to authenticated role (views need explicit grants)
GRANT SELECT ON public.v_admin_claims_overview TO authenticated;
GRANT SELECT ON public.v_admin_user_summary TO authenticated;
