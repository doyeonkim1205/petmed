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

const env = loadEnv('.env.development');
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const sr = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: sr, Authorization: `Bearer ${sr}` };

// List all profiles in dev DB
const r = await fetch(`${url}/rest/v1/profiles?select=id,email,nickname,plan&order=created_at.desc&limit=10`, { headers });
const profiles = await r.json();
console.log('Dev DB profiles:');
for (const p of profiles) {
  console.log(`  ${p.email || '(no email)'} | plan: ${p.plan} | id: ${p.id}`);
}

if (profiles.length > 0) {
  // Upgrade all to plus for testing
  for (const p of profiles) {
    if (p.plan !== 'plus') {
      await fetch(`${url}/rest/v1/profiles?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'plus' }),
      });
      console.log(`  → Upgraded ${p.email || p.id} to plus`);
    }
  }

  // Also clear any existing sessions to fix the eviction issue
  const sr2 = await fetch(`${url}/rest/v1/user_sessions?select=id,user_id&limit=100`, { headers });
  const sessions = await sr2.json();
  if (Array.isArray(sessions) && sessions.length > 0) {
    await fetch(`${url}/rest/v1/user_sessions?id=not.is.null`, {
      method: 'DELETE',
      headers,
    });
    console.log(`  → Cleared ${sessions.length} existing sessions`);
  } else {
    console.log('  → No sessions table or no sessions to clear');
  }
}
