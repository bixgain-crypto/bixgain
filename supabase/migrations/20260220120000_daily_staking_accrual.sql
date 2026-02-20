-- Schedule daily staking accrual jobs
SELECT cron.schedule(
  'daily-staking-accrual',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ibcckhhwysqhgbkyodwl.supabase.co/functions/v1/staking',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImliY2NraGh3eXNxaGdia3lvZHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNjQ3MTUsImV4cCI6MjA4Njc0MDcxNX0.BDbZjnLnZwz1M8YaUvrLGQ4H61KpAOrPMDepNlzYgOg"}'::jsonb,
    body := '{"action": "process_accruals"}'::jsonb
  ) AS request_id;
  $$
);
