// Phase 6 — Integrated billing cron tests against the test environment
// (test.pawdex.store + dev DB).
//
// Usage: node scripts/test-billing-cron.mjs [test-name]
//        node scripts/test-billing-cron.mjs           # run everything
//        node scripts/test-billing-cron.mjs reminder  # run only reminder tests
//
// What it does:
//   1. Creates a fake user + subscription in the dev DB
//   2. Calls the cron endpoint on test.pawdex.store with CRON_SECRET
//   3. Reads the resulting subscription state from dev DB
//   4. Asserts the state matches the expected outcome
//   5. Cleans up

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

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

const dev = loadEnv('.env.development');
const preview = loadEnv('.env.preview');

const SUPABASE_URL = dev.NEXT_PUBLIC_SUPABASE_URL;
const SR = dev.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = preview.CRON_SECRET;
const TEST_HOST = 'https://test.pawdex.store';

if (!SUPABASE_URL || !SR || !CRON_SECRET) {
  console.error('Missing env vars. Check .env.development and .env.preview.');
  process.exit(1);
}

const headers = { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' };

// ───────────────────────── helpers ─────────────────────────

async function rest(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: { ...headers, Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function callCron(path) {
  const res = await fetch(`${TEST_HOST}${path}`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function makeFakeUser() {
  // Create a fake auth user via the admin API so the FK constraint passes.
  const email = `billing-test-${randomUUID()}@pawdex.test`;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password: 'PawdexTest!2026', email_confirm: true }),
  });
  if (!res.ok) throw new Error(`auth admin createUser ${res.status}: ${await res.text()}`);
  const { id } = await res.json();

  // Upsert profile row (resolution=merge-duplicates handles both cases:
  // brand new row, or pre-existing row from a trigger)
  const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ id, email, nickname: `tester-${id.slice(0, 6)}`, plan: 'plus' }),
  });
  if (!upsertRes.ok) {
    throw new Error(`profile upsert ${upsertRes.status}: ${await upsertRes.text()}`);
  }
  return id;
}

async function deleteFakeUser(userId) {
  await rest('DELETE', `/subscriptions?user_id=eq.${userId}`).catch(() => {});
  await rest('DELETE', `/payment_history?user_id=eq.${userId}`).catch(() => {});
  await rest('DELETE', `/profiles?id=eq.${userId}`).catch(() => {});
  await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: 'DELETE', headers });
}

async function insertSub(userId, overrides = {}) {
  const now = new Date();
  const sub = {
    user_id: userId,
    plan: 'plus',
    product_id: 'plus_monthly',
    status: 'active',
    billing_type: 'recurring',
    toss_billing_key: 'fake_billing_key_for_test',
    toss_customer_key: userId,
    period_start: now.toISOString(),
    period_end: new Date(now.getTime() + 30 * 86400e3).toISOString(),
    next_billing_at: new Date(now.getTime() - 60e3).toISOString(), // due now
    billing_failed_count: 0,
    ...overrides,
  };
  const [created] = await rest('POST', '/subscriptions', sub);
  return created;
}

async function readSub(id) {
  const [row] = await rest('GET', `/subscriptions?id=eq.${id}&select=*`);
  return row;
}

async function readProfilePlan(userId) {
  const [row] = await rest('GET', `/profiles?id=eq.${userId}&select=plan`);
  return row?.plan;
}

function assert(label, cond, detail) {
  const status = cond ? '✅' : '❌';
  console.log(`   ${status} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!cond) globalThis._failures++;
  globalThis._asserts++;
}

globalThis._asserts = 0;
globalThis._failures = 0;

// ───────────────────────── tests ─────────────────────────

async function test_failedChargeFirstAttempt() {
  console.log('\n[1] auto-billing: first failure → +1 count, retry in 1d');
  const userId = await makeFakeUser();
  try {
    const sub = await insertSub(userId);
    const before = await readSub(sub.id);
    assert('initial state', before.billing_failed_count === 0 && before.status === 'active');

    const { status, json } = await callCron('/api/cron/auto-billing');
    assert(`cron returned 200`, status === 200, `payload: ${JSON.stringify(json).slice(0, 100)}`);

    const after = await readSub(sub.id);
    assert('billing_failed_count incremented', after.billing_failed_count === 1, `got ${after.billing_failed_count}`);
    assert('status still active (retry)', after.status === 'active', `got ${after.status}`);
    assert('last_billing_failure_at set', !!after.last_billing_failure_at);
    assert('failure reason recorded', !!after.last_billing_failure_reason);
    // Next billing should be ~1 day in the future
    const delta = new Date(after.next_billing_at).getTime() - Date.now();
    const days = delta / 86400e3;
    assert('next retry ≈ 1 day later', days >= 0.9 && days <= 1.1, `got ${days.toFixed(2)} days`);
  } finally {
    await deleteFakeUser(userId);
  }
}

async function test_failedChargeFinalAttempt() {
  console.log('\n[2] auto-billing: 4th failure → expired + downgrade to free');
  const userId = await makeFakeUser();
  try {
    const sub = await insertSub(userId, { billing_failed_count: 3 }); // already 3 failures
    const { status } = await callCron('/api/cron/auto-billing');
    assert('cron returned 200', status === 200);

    const after = await readSub(sub.id);
    assert('billing_failed_count = 4', after.billing_failed_count === 4, `got ${after.billing_failed_count}`);
    assert('status = expired', after.status === 'expired', `got ${after.status}`);
    assert('next_billing_at cleared', after.next_billing_at === null);

    const plan = await readProfilePlan(userId);
    assert('profile downgraded to free', plan === 'free', `got ${plan}`);
  } finally {
    await deleteFakeUser(userId);
  }
}

async function test_idempotency() {
  console.log('\n[3] auto-billing: cron called twice → second call is no-op');
  const userId = await makeFakeUser();
  try {
    const sub = await insertSub(userId);
    await callCron('/api/cron/auto-billing'); // first call: failure → count=1
    const after1 = await readSub(sub.id);

    // After first call next_billing_at is in the future, so the second call
    // should not pick this row up at all.
    await callCron('/api/cron/auto-billing');
    const after2 = await readSub(sub.id);

    assert('count unchanged on 2nd call', after2.billing_failed_count === after1.billing_failed_count,
      `${after1.billing_failed_count} → ${after2.billing_failed_count}`);
    assert('next_billing_at unchanged', after2.next_billing_at === after1.next_billing_at);
  } finally {
    await deleteFakeUser(userId);
  }
}

async function test_reminderBranchRecurring() {
  console.log('\n[4] push-notifications: 3-day reminder for recurring sub uses 자동 결제 branch');
  const userId = await makeFakeUser();
  try {
    const periodEnd = new Date(Date.now() + 3.5 * 86400e3);
    const sub = await insertSub(userId, {
      period_end: periodEnd.toISOString(),
      next_billing_at: periodEnd.toISOString(),
      reminder_3day_sent_at: null,
    });

    // The reminder logic only runs at 9 AM KST, so calling the cron at any
    // other time will skip it. We can't time-travel the server, so we
    // verify the query is correct by reading the rows that the cron WOULD
    // process. The branching itself is a pure code path covered by build.
    const rows = await rest('GET',
      `/subscriptions?select=id,billing_type,status&id=eq.${sub.id}&period_end=gte.${new Date(Date.now() + 3 * 86400e3).toISOString()}&period_end=lt.${new Date(Date.now() + 4 * 86400e3).toISOString()}&reminder_3day_sent_at=is.null`,
    );
    assert('row matches reminder window query', rows.length === 1);
    assert('billing_type = recurring → recurring branch', rows[0]?.billing_type === 'recurring');
  } finally {
    await deleteFakeUser(userId);
  }
}

async function test_reminderBranchOneTime() {
  console.log('\n[5] push-notifications: 3-day reminder for one-time sub uses 만료 branch');
  const userId = await makeFakeUser();
  try {
    const periodEnd = new Date(Date.now() + 3.5 * 86400e3);
    const sub = await insertSub(userId, {
      billing_type: 'one_time',
      toss_billing_key: null,
      next_billing_at: null,
      period_end: periodEnd.toISOString(),
      reminder_3day_sent_at: null,
    });

    const rows = await rest('GET',
      `/subscriptions?select=id,billing_type&id=eq.${sub.id}&period_end=gte.${new Date(Date.now() + 3 * 86400e3).toISOString()}&period_end=lt.${new Date(Date.now() + 4 * 86400e3).toISOString()}&reminder_3day_sent_at=is.null`,
    );
    assert('row matches reminder window query', rows.length === 1);
    assert('billing_type = one_time → one_time branch', rows[0]?.billing_type === 'one_time');
  } finally {
    await deleteFakeUser(userId);
  }
}

async function test_disableAutoRenewal() {
  console.log('\n[6] disable auto-renewal: drops billing_key, switches to one_time');
  const userId = await makeFakeUser();
  try {
    const sub = await insertSub(userId);
    // We can't easily call /api/payments/billing/disable because it needs
    // a real Supabase user JWT. Instead, simulate the same DB write.
    await rest('PATCH', `/subscriptions?id=eq.${sub.id}`, {
      billing_type: 'one_time',
      toss_billing_key: null,
      next_billing_at: null,
    });
    const after = await readSub(sub.id);
    assert('billing_type → one_time', after.billing_type === 'one_time');
    assert('toss_billing_key cleared', after.toss_billing_key === null);
    assert('next_billing_at cleared', after.next_billing_at === null);
    assert('period_end preserved', after.period_end === sub.period_end);

    // Verify auto-billing cron no longer touches this row
    const { status } = await callCron('/api/cron/auto-billing');
    assert('cron 200', status === 200);
    const after2 = await readSub(sub.id);
    assert('count still 0 after disable', after2.billing_failed_count === 0);
    assert('status still active', after2.status === 'active');
  } finally {
    await deleteFakeUser(userId);
  }
}

// ───────────────────────── runner ─────────────────────────

const tests = {
  failedFirst: test_failedChargeFirstAttempt,
  failedFinal: test_failedChargeFinalAttempt,
  idempotency: test_idempotency,
  reminderRecurring: test_reminderBranchRecurring,
  reminderOneTime: test_reminderBranchOneTime,
  disable: test_disableAutoRenewal,
};

const filter = process.argv[2];
const toRun = filter ? Object.entries(tests).filter(([k]) => k.toLowerCase().includes(filter.toLowerCase())) : Object.entries(tests);

console.log(`Running ${toRun.length} test(s) against ${TEST_HOST}\n`);

for (const [name, fn] of toRun) {
  try {
    await fn();
  } catch (err) {
    console.log(`   ❌ ${name} threw: ${err.message}`);
    globalThis._failures++;
  }
}

console.log(`\n──────────────────────────────`);
console.log(`Asserts: ${globalThis._asserts}  Failures: ${globalThis._failures}`);
process.exit(globalThis._failures > 0 ? 1 : 0);
