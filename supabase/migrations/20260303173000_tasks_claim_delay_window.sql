-- Enforce mission claim delay window (30s to 1h) for active social/task missions.

ALTER TABLE public.tasks
  ALTER COLUMN required_seconds SET DEFAULT 30;

UPDATE public.tasks
SET required_seconds = CASE
  WHEN required_seconds IS NULL THEN 30
  WHEN required_seconds < 30 THEN 30
  WHEN required_seconds > 3600 THEN 3600
  ELSE required_seconds
END,
updated_at = now()
WHERE task_type IN ('social', 'task_completion')
  AND is_active = true
  AND (
    required_seconds IS NULL OR
    required_seconds < 30 OR
    required_seconds > 3600
  );

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_claim_delay_window_chk;

ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_claim_delay_window_chk
  CHECK (
    task_type NOT IN ('social', 'task_completion')
    OR NOT is_active
    OR (
      required_seconds IS NOT NULL
      AND required_seconds BETWEEN 30 AND 3600
    )
  );
