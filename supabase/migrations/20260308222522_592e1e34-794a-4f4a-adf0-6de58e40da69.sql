
-- Scheduled admin tasks table
CREATE TABLE public.scheduled_admin_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL,
  operation_type TEXT NOT NULL,
  operation_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  result JSONB,
  error_message TEXT,
  prompt_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for cron to pick up pending tasks
CREATE INDEX idx_scheduled_admin_tasks_pending 
ON public.scheduled_admin_tasks (scheduled_at) 
WHERE status = 'pending';

-- RLS
ALTER TABLE public.scheduled_admin_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage scheduled tasks"
ON public.scheduled_admin_tasks
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));
