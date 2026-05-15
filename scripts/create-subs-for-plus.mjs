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

// First delete any existing expired subscriptions for these users
const profilesRes = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/profiles?plan=eq.plus&select=id,email', { headers: h });
const profiles = await profilesRes.json();

const now = new Date();
const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

for (const p of profiles) {
  // Delete existing sub first (avoid unique constraint on user_id)
  await fetch(env.NEXT_PUBLIC_SUPABASE_URL + `/rest/v1/subscriptions?user_id=eq.${p.id}`, {
    method: 'DELETE', headers: h,
  });

  // Insert fresh active subscription
  const res = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/subscriptions', {
    method: 'POST', headers: { ...h, Prefer: 'return=representation' },
    body: JSON.stringify({
      user_id: p.id,
      plan: 'plus',
      status: 'active',
      billing_type: 'one_time',
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    }),
  });
  const text = await res.text();
  console.log(p.email, '→', res.status, res.status !== 201 ? text.slice(0, 100) : 'OK');
}
