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
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: SQL }),
  });
  console.log(`[${env}] ${res.status}: ${(await res.text()).slice(0, 300)}`);
}
