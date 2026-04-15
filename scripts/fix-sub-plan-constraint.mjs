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
if (!TOKEN) { console.error('No token'); process.exit(1); }

const SQL = `
-- Fix subscriptions plan constraint
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
UPDATE public.subscriptions SET plan = 'plus' WHERE plan IN ('premium', 'basic');
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check CHECK (plan IN ('free', 'plus'));
`;

for (const [env, ref] of [['production', 'ylbxtzwbwbnlmfxqgmoz'], ['development', 'lzmmiksdvioidcldrnvh']]) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: SQL }),
  });
  console.log(`[${env}] ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
