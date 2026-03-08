-- Allow users with 5 BIX to stake in the 72-hour (3-day) plan.
WITH updated_plans AS (
  UPDATE public.staking_plans
  SET
    min_amount = 5,
    updated_at = now()
  WHERE is_active = true
    AND (
      duration_days = 3
      OR lower(name) LIKE '%72h%'
      OR lower(name) LIKE '%72 h%'
      OR lower(name) LIKE '%72-hour%'
      OR lower(name) LIKE '%72 hour%'
      OR lower(name) LIKE '%72hr%'
      OR lower(name) LIKE '%72 hrs%'
    )
  RETURNING id
)
INSERT INTO public.staking_plans (
  name,
  duration_days,
  apy_rate,
  min_amount,
  max_amount,
  early_unstake_penalty,
  is_active
)
SELECT
  '72 Hours',
  3,
  COALESCE(
    (
      SELECT apy_rate
      FROM public.staking_plans
      WHERE is_active = true
      ORDER BY duration_days ASC, created_at ASC
      LIMIT 1
    ),
    5
  ),
  5,
  (
    SELECT max_amount
    FROM public.staking_plans
    WHERE is_active = true
    ORDER BY duration_days ASC, created_at ASC
    LIMIT 1
  ),
  COALESCE(
    (
      SELECT early_unstake_penalty
      FROM public.staking_plans
      WHERE is_active = true
      ORDER BY duration_days ASC, created_at ASC
      LIMIT 1
    ),
    0.05
  ),
  true
WHERE NOT EXISTS (SELECT 1 FROM updated_plans)
  AND NOT EXISTS (
    SELECT 1
    FROM public.staking_plans
    WHERE is_active = true
      AND (
        duration_days = 3
        OR lower(name) LIKE '%72h%'
        OR lower(name) LIKE '%72 h%'
        OR lower(name) LIKE '%72-hour%'
        OR lower(name) LIKE '%72 hour%'
        OR lower(name) LIKE '%72hr%'
        OR lower(name) LIKE '%72 hrs%'
      )
  );
