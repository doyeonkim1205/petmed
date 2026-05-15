import { readFileSync } from 'node:fs';

function loadEnv(p) {
  const out = {};
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) { let v=m[2].trim(); if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1); v=v.replace(/\\n$/,''); out[m[1]]=v; }
  }
  return out;
}

const env = loadEnv('.env.production');
const h = {apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json'};

// premium → plus
const r1 = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/profiles?plan=eq.premium', {
  method: 'PATCH', headers: h, body: JSON.stringify({plan: 'plus'})
});
console.log('premium → plus:', r1.status);

// basic → free
const r2 = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/profiles?plan=eq.basic', {
  method: 'PATCH', headers: h, body: JSON.stringify({plan: 'free'})
});
console.log('basic → free:', r2.status);

// Verify
const r3 = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/profiles?select=email,plan&order=created_at', { headers: h });
const data = await r3.json();
console.log('\nAll profiles after fix:');
data.forEach(p => console.log(`  ${p.email} → ${p.plan}`));
