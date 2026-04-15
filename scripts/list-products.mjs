import { readFileSync } from 'node:fs';

function loadEnv(path) {
  const text = readFileSync(path, 'utf8');
  const out = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    v = v.replace(/\\n$/, '');
    out[m[1]] = v;
  }
  return out;
}

for (const t of [
  { name: 'production', envFile: '.env.production' },
  { name: 'development', envFile: '.env.development' },
]) {
  const env = loadEnv(t.envFile);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const sr = env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(`${url}/rest/v1/payment_products?select=id,name,price,period,active&order=price.asc`, {
    headers: { apikey: sr, Authorization: `Bearer ${sr}` },
  });
  console.log(`[${t.name}] ${r.status}: ${await r.text()}`);
}
