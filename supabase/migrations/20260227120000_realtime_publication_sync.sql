-- Ensure all app sync tables are present in the Supabase realtime publication.
DO $$
DECLARE
  _table_name TEXT;
BEGIN
  FOREACH _table_name IN ARRAY ARRAY[
    'public.users',
    'public.wallets',
    'public.stakes',
    'public.activities',
    'public.referrals',
    'public.tasks',
    'public.claims',
    'public.reward_transactions',
    'public.task_attempts',
    'public.platform_settings',
    'public.admin_audit_log'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = split_part(_table_name, '.', 1)
        AND tablename = split_part(_table_name, '.', 2)
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %s;', _table_name);
    END IF;
  END LOOP;
END;
$$;
