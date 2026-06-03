#!/usr/bin/env node
// env 파일의 비밀 키 prefix 만 안전하게 확인.
//
// 출력 원칙:
//   - 절대 raw key 값 전체 출력 X
//   - 알려진 prefix (live_/test_/sk-/eyJ) 면 prefix + 길이만
//   - 알려진 prefix 가 아니면 [hash] 표시 + 처음 4자 + 길이
//
// 사용:
//   vercel env pull --environment=production .env.prod-temp.local
//   node scripts/check-env-prefix.mjs .env.prod-temp.local
//   rm -f .env.prod-temp.local

import fs from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('사용법: node scripts/check-env-prefix.mjs <.env file>');
  process.exit(1);
}

const env = fs.readFileSync(path, 'utf8');

// safeKeyPrefix — 키 형태별 안전 redaction.
function safeKeyPrefix(value) {
  if (!value) return 'MISSING';
  const v = value.replace(/^['"]|['"]$/g, '');
  const len = v.length;
  const tag = (label, judge) =>
    `${label}*** (len=${len})${judge ? ' ' + judge : ''}`;

  // 토스 결제 (live_/test_)
  if (v.startsWith('live_'))     return tag('live_',   '✅ LIVE/PROD');
  if (v.startsWith('test_'))     return tag('test_',   '⚠️ TEST/SANDBOX');
  // OpenAI
  if (v.startsWith('sk-proj-'))  return tag('sk-proj-', '✅ OpenAI Project');
  if (v.startsWith('sk-'))       return tag('sk-',      '✅ OpenAI');
  // JWT (Supabase anon / service_role 등)
  if (v.startsWith('eyJ'))       return tag('eyJ',      '✅ JWT');
  // Supabase Management Access Token
  if (v.startsWith('sbp_'))      return tag('sbp_',     '✅ Supabase Mgmt');
  // VAPID public key (URL-safe base64 일반적)
  if (/^[A-Za-z0-9_-]{80,90}$/.test(v)) return tag('VAPID-', '✅ VAPID');

  // 알려진 prefix 아님 — hash 형태 등. 첫 4자만 노출 (가능 영역 좁히고 명시).
  const first4 = v.slice(0, 4);
  return `[hash]${first4}*** (len=${len})  ⚠️ unknown shape — verify in console`;
}

// .env 파싱 (단순 — KEY=VALUE 라인만)
const entries = env
  .split(/\r?\n/)
  .filter(line => /^\s*[A-Z_][A-Z0-9_]*\s*=/.test(line))
  .map(line => {
    const idx = line.indexOf('=');
    return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
  });

// 비밀 키 패턴 — 출력할 변수 필터.
const SECRET_PATTERNS = [
  /KEY$/i, /SECRET/i, /TOKEN/i, /CRON_SECRET/, /VAPID/i,
];
const filtered = entries.filter(([k]) => SECRET_PATTERNS.some(re => re.test(k)));

console.log(`=== 비밀 키 prefix 확인 (${path}) ===`);
console.log(`총 ${filtered.length} 개\n`);
for (const [k, v] of filtered) {
  console.log(`  ${k.padEnd(40)} = ${safeKeyPrefix(v)}`);
}
console.log(`\n⚠️ 확인 후 ${path} 즉시 삭제:  rm -f ${path}`);
