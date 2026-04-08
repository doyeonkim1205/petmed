import { readFileSync } from 'node:fs';

function readToken() {
  try {
    const text = readFileSync('.env.local', 'utf8');
    const m = text.match(/^SUPABASE_ACCESS_TOKEN=(.*)$/m);
    if (m) {
      let v = m[1].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return v;
    }
  } catch {}
  return process.env.SUPABASE_ACCESS_TOKEN || '';
}
const TOKEN = readToken();
if (!TOKEN) {
  console.error('SUPABASE_ACCESS_TOKEN not found in .env.local');
  process.exit(1);
}

const PROJECTS = {
  production: 'ylbxtzwbwbnlmfxqgmoz',
  development: 'lzmmiksdvioidcldrnvh',
};

const SQL = `
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS card_company text,
  ADD COLUMN IF NOT EXISTS card_number text;
`;

for (const [env, ref] of Object.entries(PROJECTS)) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: SQL }),
  });
  console.log(`[${env}] ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
