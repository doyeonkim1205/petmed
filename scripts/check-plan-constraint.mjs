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

// Check constraints and triggers on profiles table
const SQL = `
SELECT conname, pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass;

SELECT tgname, pg_get_triggerdef(oid) as definition
FROM pg_trigger
WHERE tgrelid = 'public.profiles'::regclass AND NOT tgisinternal;
`;

for (const [env, ref] of [['development', 'lzmmiksdvioidcldrnvh'], ['production', 'ylbxtzwbwbnlmfxqgmoz']]) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: SQL }),
  });
  console.log(`[${env}] ${res.status}: ${(await res.text()).slice(0, 500)}`);
}
