import { readFileSync } from 'node:fs';


import { tokenForRef } from './lib/managementToken.mjs';
const SQL = `
-- 1. Drop old constraint first
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;

-- 2. Migrate legacy values (no constraint in the way now)
UPDATE public.profiles SET plan = 'plus' WHERE plan IN ('premium', 'basic_plus');
UPDATE public.profiles SET plan = 'free' WHERE plan NOT IN ('free', 'plus');

-- 3. Add new constraint (all rows now have valid values)
ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_check
  CHECK (plan IN ('free', 'plus'));
`;

for (const [env, ref] of [['production', 'ylbxtzwbwbnlmfxqgmoz'], ['development', 'lzmmiksdvioidcldrnvh']]) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenForRef(ref)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: SQL }),
  });
  console.log(`[${env}] ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
