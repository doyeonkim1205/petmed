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

// Try premium → plus with full error output
const r = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/profiles?plan=eq.premium', {
  method: 'PATCH', headers: h, body: JSON.stringify({plan: 'plus'})
});
console.log('Status:', r.status);
console.log('Body:', await r.text());
