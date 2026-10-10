import { readFileSync } from 'node:fs';


import { tokenForRef } from './lib/managementToken.mjs';
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
      Authorization: `Bearer ${tokenForRef(ref)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: SQL }),
  });
  console.log(`[${env}] ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
