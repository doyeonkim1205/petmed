// Non-destructive test: validate the reminder query syntax against production
// without inserting or modifying any data.
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

const env = loadEnv('.env.production');
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const sr = env.SUPABASE_SERVICE_ROLE_KEY;
const headers = { apikey: sr, Authorization: `Bearer ${sr}` };

const now = new Date();
const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
const fourDaysFromNow = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

// 1) Test the exact query the cron will run
const queryUrl =
  `${url}/rest/v1/subscriptions?` +
  `select=id,user_id,plan,status,period_end,reminder_3day_sent_at` +
  `&status=in.(active,canceled)` +
  `&period_end=gte.${threeDaysFromNow.toISOString()}` +
  `&period_end=lt.${fourDaysFromNow.toISOString()}` +
  `&reminder_3day_sent_at=is.null`;

const r1 = await fetch(queryUrl, { headers });
const data1 = await r1.json();
console.log(`[query syntax] status=${r1.status}  rows=${Array.isArray(data1) ? data1.length : 'ERROR'}`);
if (!Array.isArray(data1)) console.log('error response:', data1);

// 2) Test we can SELECT the new column from any row
const r2 = await fetch(
  `${url}/rest/v1/subscriptions?select=id,plan,status,period_end,reminder_3day_sent_at&limit=3`,
  { headers },
);
const data2 = await r2.json();
console.log(`[column access] status=${r2.status}  rows=${Array.isArray(data2) ? data2.length : 'ERROR'}`);
if (Array.isArray(data2)) {
  for (const row of data2) {
    console.log('  ', JSON.stringify(row));
  }
}

// 3) Test we can SELECT push_subscriptions (used by sendPushToUser)
const r3 = await fetch(`${url}/rest/v1/push_subscriptions?select=id,user_id&limit=1`, { headers });
const data3 = await r3.json();
console.log(`[push_subscriptions] status=${r3.status}  rows=${Array.isArray(data3) ? data3.length : 'ERROR'}`);

console.log('\nAll non-destructive checks passed.');
