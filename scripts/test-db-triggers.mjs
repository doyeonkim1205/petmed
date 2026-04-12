import { readFileSync } from 'node:fs';

function loadEnv(p) {
  const out = {};
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) { let v=m[2].trim(); if(v.startsWith('"')&&v.endsWith('"'))v=v.slice(1,-1); v=v.replace(/\\n$/,''); out[m[1]]=v; }
  }
  return out;
}

const env = loadEnv('.env.development');
const h = {apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json'};

// Use existing free user
const r = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/profiles?plan=eq.free&select=id&limit=1', { headers: h });
const profiles = await r.json();
if (!profiles.length) { console.log('No free user to test with'); process.exit(0); }
const userId = profiles[0].id;
console.log('Testing with free user:', userId.slice(0, 8));

// Count current pets
const { count: petCount } = await (await fetch(
  env.NEXT_PUBLIC_SUPABASE_URL + `/rest/v1/pets?user_id=eq.${userId}&select=id`,
  { headers: {...h, Prefer: 'count=exact'} }
)).json().catch(() => ({ count: 0 }));

const petsRes = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/pets?user_id=eq.' + userId + '&select=id', { headers: h });
const pets = await petsRes.json();
console.log('Current pets:', pets.length);

// If less than 2, add to reach limit
for (let i = pets.length; i < 2; i++) {
  await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/pets', {
    method: 'POST', headers: h,
    body: JSON.stringify({ user_id: userId, name: `테스트펫${i}`, type: 'dog' }),
  });
}

// Now try adding one more (should fail!)
const res3 = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/pets', {
  method: 'POST', headers: h,
  body: JSON.stringify({ user_id: userId, name: '초과펫', type: 'cat' }),
});
const text3 = await res3.text();
const blocked = res3.status !== 201;
console.log(`3rd pet insert: ${res3.status} ${blocked ? '✅ BLOCKED' : '❌ NOT BLOCKED'}`);
if (blocked) console.log('  Error:', text3.slice(0, 150));

// Clean up test pets
await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/pets?user_id=eq.' + userId + '&name=like.테스트펫*', { method: 'DELETE', headers: h });
await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/pets?user_id=eq.' + userId + '&name=eq.초과펫', { method: 'DELETE', headers: h });

// Test record limit similarly
const recsRes = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/health_records?user_id=eq.' + userId + '&select=id', { headers: h });
const recs = await recsRes.json();
console.log('\nCurrent records:', recs.length);

// Add records to reach 15
for (let i = recs.length; i < 15; i++) {
  await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/health_records', {
    method: 'POST', headers: h,
    body: JSON.stringify({ user_id: userId, title: `테스트기록${i}`, record_type: 'symptom', visit_date: '2026-01-01' }),
  });
}

// Try 16th (should fail!)
const res16 = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/health_records', {
  method: 'POST', headers: h,
  body: JSON.stringify({ user_id: userId, title: '초과기록', record_type: 'symptom', visit_date: '2026-01-01' }),
});
const text16 = await res16.text();
const blocked16 = res16.status !== 201;
console.log(`16th record insert: ${res16.status} ${blocked16 ? '✅ BLOCKED' : '❌ NOT BLOCKED'}`);
if (blocked16) console.log('  Error:', text16.slice(0, 150));

// Clean up
await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/health_records?user_id=eq.' + userId + '&title=like.테스트기록*', { method: 'DELETE', headers: h });
await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/health_records?user_id=eq.' + userId + '&title=eq.초과기록', { method: 'DELETE', headers: h });

console.log('\nDone!');
