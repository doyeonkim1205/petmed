#!/usr/bin/env node
/**
 * Supabase 보안 불변식(invariants) 회귀 가드.
 *
 * 결제/권한 관련 "이게 깨지면 무료로 Plus 되거나 데이터 위변조 가능" 한 4가지를 단언한다.
 * 마이그레이션·정책 변경 후 돌려서 보안 가정이 그대로인지 확인용.
 *
 * 사용:
 *   node scripts/check-security-invariants.mjs            # dev (기본)
 *   node scripts/check-security-invariants.mjs prod       # prod
 *
 * 토큰: .env.local 의 SUPABASE_ACCESS_TOKEN (또는 환경변수). raw 출력/저장 안 함.
 * 실패가 하나라도 있으면 exit 1.
 */
import { readFileSync } from 'node:fs';

const REFS = { dev: 'lzmmiksdvioidcldrnvh', prod: 'ylbxtzwbwbnlmfxqgmoz' };
const target = (process.argv[2] || 'dev').toLowerCase();
const ref = REFS[target];
if (!ref) { console.error(`알 수 없는 대상: ${target} (dev|prod)`); process.exit(2); }

// 토큰: env 우선, 없으면 .env.local 파싱
function readToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim();
  try {
    const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    const m = env.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '');
  } catch { /* ignore */ }
  return null;
}
const TOKEN = readToken();
if (!TOKEN) { console.error('SUPABASE_ACCESS_TOKEN 없음 (.env.local 확인)'); process.exit(2); }

async function q(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`query 실패 ${res.status}: ${await res.text()}`);
  return res.json();
}

const eqSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

// ── 불변식 정의 ──
const SAFE_PROFILE_UPDATE = ['avatar_url', 'is_push_enabled', 'nickname', 'preferred_language'];
const RLS_TABLES = ['profiles','subscriptions','payment_history','health_records','pets','medications','health_metrics','preventive_cares','expenses'];

const TESTS = [
  {
    name: '1) profiles.plan/role 는 클라이언트가 UPDATE 못 함 (권한 자가부여 차단)',
    async run() {
      const rows = await q(`select column_name from information_schema.column_privileges where table_schema='public' and table_name='profiles' and grantee='authenticated' and privilege_type='UPDATE' and column_name in ('plan','role','id','email');`);
      const bad = rows.map(r => r.column_name);
      return { ok: bad.length === 0, detail: bad.length ? `위험 컬럼 UPDATE 가능: ${bad.join(', ')}` : 'plan/role/id/email 모두 UPDATE 불가' };
    },
  },
  {
    name: '2) profiles 클라이언트 UPDATE 허용 컬럼 = 안전 화이트리스트와 정확히 일치',
    async run() {
      const rows = await q(`select column_name from information_schema.column_privileges where table_schema='public' and table_name='profiles' and grantee='authenticated' and privilege_type='UPDATE';`);
      const cols = rows.map(r => r.column_name);
      return { ok: eqSet(cols, SAFE_PROFILE_UPDATE), detail: `허용=[${cols.sort().join(', ')}] / 기대=[${SAFE_PROFILE_UPDATE.join(', ')}]` };
    },
  },
  {
    name: '3) 핵심 테이블 RLS 활성화',
    async run() {
      const rows = await q(`select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in (${RLS_TABLES.map(t=>`'${t}'`).join(',')});`);
      const off = rows.filter(r => !r.relrowsecurity).map(r => r.relname);
      const missing = RLS_TABLES.filter(t => !rows.find(r => r.relname === t));
      const problems = [...off.map(t=>`${t}:RLS off`), ...missing.map(t=>`${t}:없음`)];
      return { ok: problems.length === 0, detail: problems.length ? problems.join(', ') : `${rows.length}개 테이블 RLS 활성` };
    },
  },
  {
    name: '4) subscriptions/payment_history 는 클라이언트 쓰기 불가 (SELECT 정책만 존재)',
    async run() {
      const rows = await q(`select tablename, cmd from pg_policies where schemaname='public' and tablename in ('subscriptions','payment_history') and cmd <> 'SELECT';`);
      const bad = rows.map(r => `${r.tablename}:${r.cmd}`);
      return { ok: bad.length === 0, detail: bad.length ? `쓰기 정책 존재(위험): ${bad.join(', ')}` : '결제 테이블 쓰기 정책 없음 (서비스롤 전용)' };
    },
  },
];

console.log(`\n🔒 Supabase 보안 불변식 점검 — 대상: ${target} (${ref})\n`);
let failed = 0;
for (const t of TESTS) {
  try {
    const { ok, detail } = await t.run();
    console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${t.name}\n          ${detail}`);
    if (!ok) failed++;
  } catch (e) {
    console.log(`⚠️  ERROR ${t.name}\n          ${e.message}`);
    failed++;
  }
}
console.log(`\n${failed === 0 ? '✅ 전체 통과' : `❌ ${failed}개 실패`} (${TESTS.length}개 중)\n`);
process.exit(failed === 0 ? 0 : 1);
