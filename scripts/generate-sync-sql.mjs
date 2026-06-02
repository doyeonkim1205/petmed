// PROD 의 누락 객체들을 DDL 로 추출해서 DEV 적용용 SQL 생성.
// 결과: scripts/sync-dev.sql

import fs from 'fs';

function readToken() {
  const env = fs.readFileSync('.env.local', 'utf8');
  return env.match(/^SUPABASE_ACCESS_TOKEN\s*=\s*['"]?([^'"\r\n]+)['"]?/m)[1];
}

const TOKEN = readToken();
const PROD = 'ylbxtzwbwbnlmfxqgmoz';

async function q(ref, sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  return r.json();
}

let sql = `-- DEV DB 와 PROD DB 의 스키마 차이를 메우는 마이그레이션
-- 생성: ${new Date().toISOString().slice(0, 10)}
-- 적용 대상: lzmmiksdvioidcldrnvh (pawdex-dev)
-- 멱등성: 모든 문장이 IF NOT EXISTS / OR REPLACE 사용

BEGIN;

`;

// 1. subscription_events 테이블 — PROD DDL 그대로 재구성
sql += `-- ── 1. subscription_events 테이블 신규 ──
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type = ANY (ARRAY['purchase'::text, 'renew'::text, 'cancel'::text, 'refund'::text, 'expired'::text, 'downgrade'::text, 'upgrade'::text])),
  plan TEXT NOT NULL CHECK (plan = ANY (ARRAY['basic'::text, 'premium'::text])),
  amount INTEGER NULL,
  reason TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_subscription_events_user ON public.subscription_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON public.subscription_events (event_type, created_at DESC);
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.subscription_events;
CREATE POLICY "Service role full access" ON public.subscription_events
  FOR ALL USING (auth.role() = 'service_role'::text);
DROP POLICY IF EXISTS "Users can view own events" ON public.subscription_events;
CREATE POLICY "Users can view own events" ON public.subscription_events
  FOR SELECT USING (auth.uid() = user_id);

`;

// 2. activity_logs.user_id NULL 허용 + search_logs.kind default
sql += `-- ── 2. Column 정밀 차이 보정 ──
ALTER TABLE public.activity_logs ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.search_logs ALTER COLUMN kind SET DEFAULT 'disease';

`;

// 3. Functions — PROD 에서 DDL 추출
const fnNames = ['dedup_auth_login', 'get_cron_last_run', 'prevent_role_change'];
sql += `-- ── 3. 누락 함수 ──\n`;
for (const fn of fnNames) {
  const r = await q(PROD, `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p WHERE p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname='public') AND p.proname = '${fn}'`);
  if (r[0]?.def) {
    // CREATE OR REPLACE 로 idempotent
    let def = r[0].def.replace(/^CREATE FUNCTION/, 'CREATE OR REPLACE FUNCTION');
    sql += def + ';\n\n';
  }
}

// 4. Indexes — PROD 에만 있는 인덱스 추가 (subscription_events 관련은 위에서 처리됨)
const idxSkip = new Set(['idx_subscription_events_user', 'idx_subscription_events_type', 'subscription_events_pkey']);
const prodIdx = await q(PROD, "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY indexname");
const devIdx = new Set((await q('lzmmiksdvioidcldrnvh', "SELECT indexname FROM pg_indexes WHERE schemaname='public'")).map(r => r.indexname));
sql += `-- ── 4. 누락 인덱스 ──\n`;
for (const { indexname, indexdef } of prodIdx) {
  if (devIdx.has(indexname)) continue;
  if (idxSkip.has(indexname)) continue;
  // CREATE INDEX → CREATE INDEX IF NOT EXISTS
  // CREATE UNIQUE INDEX → CREATE UNIQUE INDEX IF NOT EXISTS
  const safe = indexdef
    .replace(/^CREATE UNIQUE INDEX /, 'CREATE UNIQUE INDEX IF NOT EXISTS ')
    .replace(/^CREATE INDEX /, 'CREATE INDEX IF NOT EXISTS ');
  sql += safe + ';\n';
}
sql += '\n';

// 5. CHECK constraints — PROD 에만 있는 거 추가
const ccSkip = new Set(['subscription_events_event_type_check', 'subscription_events_plan_check']);  // 위에서 처리됨
const prodCC = await q(PROD, "SELECT conrelid::regclass::text AS tbl, conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname='public') AND contype='c'");
const devCC = new Set((await q('lzmmiksdvioidcldrnvh', "SELECT conname FROM pg_constraint WHERE connamespace = (SELECT oid FROM pg_namespace WHERE nspname='public') AND contype='c'")).map(r => r.conname));
sql += `-- ── 5. 누락 CHECK constraints ──\n`;
for (const { tbl, conname, def } of prodCC) {
  if (devCC.has(conname)) continue;
  if (ccSkip.has(conname)) continue;
  // DO 블록으로 IF NOT EXISTS 시뮬레이션 (ALTER TABLE ADD CONSTRAINT 는 IF NOT EXISTS 지원 안 함)
  sql += `DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${conname}') THEN
    ALTER TABLE ${tbl} ADD CONSTRAINT ${conname} ${def};
  END IF;
END $do$;
`;
}
sql += '\n';

// 6. RLS policies — PROD 에만 있는 정책 추가 (DEV 의 users_own 통합 정책은 그대로 두고 공존)
//    subscription_events 관련은 위에서 처리됨
const polSkip = new Set();  // (tbl, name) 형식. 위에서 처리한 것들.
const prodPol = await q(PROD, `
  SELECT tablename, policyname, cmd, qual, with_check,
    array_to_string(roles, ',') AS roles_str
  FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname
`);
const devPolKeys = new Set((await q('lzmmiksdvioidcldrnvh', "SELECT tablename || '.' || policyname AS k FROM pg_policies WHERE schemaname='public'")).map(r => r.k));
sql += `-- ── 6. 누락 RLS 정책 (PROD 의 세분화된 정책 — DEV 의 users_own 통합 정책과 공존) ──\n`;
for (const { tablename, policyname, cmd, qual, with_check } of prodPol) {
  const key = `${tablename}.${policyname}`;
  if (devPolKeys.has(key)) continue;
  // subscription_events 는 위에서 처리됨
  if (tablename === 'subscription_events') continue;
  // CREATE POLICY 문법
  let stmt = `CREATE POLICY "${policyname}" ON public.${tablename} FOR ${cmd}`;
  if (qual) stmt += ` USING (${qual})`;
  if (with_check) stmt += ` WITH CHECK (${with_check})`;
  sql += `DROP POLICY IF EXISTS "${policyname}" ON public.${tablename};\n${stmt};\n`;
}
sql += '\n';

sql += `COMMIT;\n`;

fs.writeFileSync('scripts/sync-dev.sql', sql);
console.log('Generated scripts/sync-dev.sql');
console.log('Lines:', sql.split('\n').length);
