import { readFileSync } from 'node:fs';

function readToken() {
  try {
    const text = readFileSync('.env.local', 'utf8');
    const m = text.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m);
    if (m) { let v = m[1].trim(); if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1); return v; }
  } catch {}
  return '';
}
const TOKEN = readToken();
if (!TOKEN) { console.error('No SUPABASE_ACCESS_TOKEN'); process.exit(1); }

const PROJECTS = {
  production: 'ylbxtzwbwbnlmfxqgmoz',
  development: 'lzmmiksdvioidcldrnvh',
};

const SQL = `
-- 1. Pet limit trigger
CREATE OR REPLACE FUNCTION check_pet_limit()
RETURNS TRIGGER AS $$
DECLARE
  pet_count INTEGER;
  user_plan TEXT;
  max_pets INTEGER;
BEGIN
  SELECT plan INTO user_plan FROM public.profiles WHERE id = NEW.user_id;
  SELECT COUNT(*) INTO pet_count FROM public.pets WHERE user_id = NEW.user_id;

  IF user_plan IS NULL OR user_plan = 'free' THEN
    max_pets := 2;
  ELSE
    max_pets := 0;
  END IF;

  IF max_pets > 0 AND pet_count >= max_pets THEN
    RAISE EXCEPTION 'PET_LIMIT_REACHED: 반려동물 등록 한도(%마리)에 도달했습니다.', max_pets;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_pet_limit ON public.pets;
CREATE TRIGGER enforce_pet_limit
  BEFORE INSERT ON public.pets
  FOR EACH ROW EXECUTE FUNCTION check_pet_limit();

-- 2. Health record limit trigger
CREATE OR REPLACE FUNCTION check_record_limit()
RETURNS TRIGGER AS $$
DECLARE
  record_count INTEGER;
  user_plan TEXT;
  max_records INTEGER;
BEGIN
  SELECT plan INTO user_plan FROM public.profiles WHERE id = NEW.user_id;
  SELECT COUNT(*) INTO record_count FROM public.health_records WHERE user_id = NEW.user_id;

  IF user_plan IS NULL OR user_plan = 'free' THEN
    max_records := 15;
  ELSE
    max_records := 0;
  END IF;

  IF max_records > 0 AND record_count >= max_records THEN
    RAISE EXCEPTION 'RECORD_LIMIT_REACHED: 건강 기록 한도(%개)에 도달했습니다.', max_records;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_record_limit ON public.health_records;
CREATE TRIGGER enforce_record_limit
  BEFORE INSERT ON public.health_records
  FOR EACH ROW EXECUTE FUNCTION check_record_limit();
`;

for (const [env, ref] of Object.entries(PROJECTS)) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: SQL }),
  });
  console.log(`[${env}] ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
