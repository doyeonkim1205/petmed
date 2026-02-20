-- Diagnostic: count actual rows in key tables (runs as postgres role, bypasses RLS)
DO $$
DECLARE
  cnt bigint;
BEGIN
  SELECT count(*) INTO cnt FROM public.pets;
  RAISE NOTICE 'pets: % rows', cnt;

  SELECT count(*) INTO cnt FROM public.health_records;
  RAISE NOTICE 'health_records: % rows', cnt;

  SELECT count(*) INTO cnt FROM public.medications;
  RAISE NOTICE 'medications: % rows', cnt;

  SELECT count(*) INTO cnt FROM public.profiles;
  RAISE NOTICE 'profiles: % rows', cnt;
END $$;
