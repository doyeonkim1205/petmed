-- Check which users own which data
DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '=== PETS ===';
  FOR r IN SELECT p.id, p.name, p.type, p.user_id, pr.email
    FROM public.pets p LEFT JOIN public.profiles pr ON p.user_id = pr.id
  LOOP
    RAISE NOTICE 'Pet: % (%) owner: %', r.name, r.type, r.email;
  END LOOP;

  RAISE NOTICE '=== HEALTH RECORDS ===';
  FOR r IN SELECT hr.id, hr.title, hr.user_id, pr.email
    FROM public.health_records hr LEFT JOIN public.profiles pr ON hr.user_id = pr.id
  LOOP
    RAISE NOTICE 'Record: % owner: %', r.title, r.email;
  END LOOP;
END $$;
