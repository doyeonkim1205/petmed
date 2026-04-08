// Insert plus_yearly product into both DBs via the REST API + service_role key.
// Run with: node scripts/add-yearly-product.mjs

import { readFileSync } from 'node:fs';

function loadEnv(path) {
  const text = readFileSync(path, 'utf8');
  const out = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    // Handle escaped \n that vercel adds when pulling envs
    v = v.replace(/\\n$/, '');
    out[m[1]] = v;
  }
  return out;
}

const targets = [
  { name: 'production', envFile: '.env.production' },
  { name: 'development', envFile: '.env.development' },
];

const product = {
  id: 'plus_yearly',
  name: 'PawDex Plus 연간 구독',
  plan: 'plus',
  price: 40000,
  period: 'year',
  description: '연간 결제, 월 3,333원 (월간 대비 약 14% 할인)',
  active: true,
};

for (const t of targets) {
  const env = loadEnv(t.envFile);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const sr = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sr) {
    console.log(`[${t.name}] missing env vars, skipping`);
    continue;
  }
  const res = await fetch(`${url}/rest/v1/payment_products`, {
    method: 'POST',
    headers: {
      apikey: sr,
      Authorization: `Bearer ${sr}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(product),
  });
  const text = await res.text();
  console.log(`[${t.name}] ${res.status}: ${text.slice(0, 300)}`);
}
