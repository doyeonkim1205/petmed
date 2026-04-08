// Add reminder tracking column to subscriptions table on both DBs.
// Run with: node scripts/add-reminder-columns.mjs

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
    v = v.replace(/\\n$/, '');
    out[m[1]] = v;
  }
  return out;
}

// We use the PostgREST-exposed pg_meta-style endpoint via a SQL function we create
// once. Since service_role can't run raw DDL via REST, we instead create a SQL
// helper function that anyone with service_role can call.
//
// However, the simplest reliable approach is to use the pg-meta API directly
// through the Supabase Management API. Since that token is dead, we fall back
// to having the user paste the SQL in the dashboard.
//
// For automation we use a one-time helper RPC. Let's just print the SQL
// for the user to paste, and ALSO try the rpc approach in case it works.

const SQL = `ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS reminder_3day_sent_at timestamptz;`;

console.log('=== SQL to run in Supabase Dashboard SQL Editor ===');
console.log(SQL);
console.log('===================================================');
console.log('');

// Try via service role RPC (only works if exec_sql function exists)
for (const t of [
  { name: 'production', envFile: '.env.production' },
  { name: 'development', envFile: '.env.development' },
]) {
  const env = loadEnv(t.envFile);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const sr = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !sr) {
    console.log(`[${t.name}] missing env, skip`);
    continue;
  }
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      apikey: sr,
      Authorization: `Bearer ${sr}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: SQL }),
  });
  console.log(`[${t.name}] rpc/exec_sql ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
