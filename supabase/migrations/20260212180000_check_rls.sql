-- Diagnostic: check RLS status and policies for key tables
-- This is a no-op migration that just needs to run successfully

DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '=== RLS STATUS ===';
  FOR r IN
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  LOOP
    RAISE NOTICE 'Table: %, RLS: %', r.tablename, r.rowsecurity;
  END LOOP;

  RAISE NOTICE '=== POLICIES ===';
  FOR r IN
    SELECT tablename, policyname, permissive, cmd, qual
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, cmd
  LOOP
    RAISE NOTICE 'Table: %, Policy: %, Perm: %, Cmd: %, Qual: %',
      r.tablename, r.policyname, r.permissive, r.cmd, r.qual;
  END LOOP;
END $$;
