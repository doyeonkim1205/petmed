// Supabase Management API 토큰 — 프로젝트별 scoped PAT 분리 (2026-10).
//   운영 ref → SUPABASE_ACCESS_TOKEN_PROD (Database Read 전용)
//   개발 ref → SUPABASE_ACCESS_TOKEN_DEV  (Database Read-write)
// 레거시 SUPABASE_ACCESS_TOKEN(계정 전체 권한)은 더 이상 읽지 않음 — 폴백 없음.
// 토큰 값은 절대 출력하지 않음.
import fs from 'node:fs';

export const PROD_REF = 'ylbxtzwbwbnlmfxqgmoz';
export const DEV_REF = 'lzmmiksdvioidcldrnvh';
const VAR_BY_REF = { [PROD_REF]: 'SUPABASE_ACCESS_TOKEN_PROD', [DEV_REF]: 'SUPABASE_ACCESS_TOKEN_DEV' };

function readVar(name) {
  if (process.env[name]) return process.env[name].trim();
  try {
    const env = fs.readFileSync('.env.local', 'utf8');
    const m = env.match(new RegExp('^' + name + '\\s*=\\s*[\'"]?([^\'"\\r\\n]+)[\'"]?', 'm'));
    return m ? m[1].trim() : '';
  } catch {
    return '';
  }
}

export function tokenForRef(ref) {
  const name = VAR_BY_REF[ref];
  if (!name) throw new Error(`unknown Supabase project ref: ${ref}`);
  const tok = readVar(name);
  if (!tok) {
    console.error(`${name} 이 .env.local(또는 환경변수)에 없습니다. 프로젝트별 scoped 토큰을 발급해 등록하세요: https://supabase.com/dashboard/account/tokens`);
    process.exit(2);
  }
  return tok;
}
