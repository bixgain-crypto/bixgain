-- Ensure profile/account-status and claimable reward notifications stream through Realtime.
DO $$
DECLARE
  _table_name TEXT;
BEGIN
  FOREACH _table_name IN ARRAY ARRAY[
    'public.profiles',
    'public.user_reward_notifications'
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
