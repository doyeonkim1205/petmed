// 실행: node --experimental-strip-types scripts/test-storageQuota.mts
import { evaluateQuota, parseIncomingBytes, toMB, BYTES_PER_MB, MAX_INCOMING_BYTES } from '../src/lib/storageQuota.ts';

let pass = 0, fail = 0;
function eq(actual: unknown, expected: unknown, name: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; }
  else { fail++; console.log(`  ✗ ${name}  expected=${JSON.stringify(expected)} got=${JSON.stringify(actual)}`); }
}
const MB = BYTES_PER_MB;

console.log('[evaluateQuota — 무료 50MB]');
eq(evaluateQuota(0, 0, 50).canUpload, true, '빈 계정');
eq(evaluateQuota(49 * MB, 1 * MB, 50).canUpload, true, '49 + 1 = 50 (한도 정확히) 허용');
eq(evaluateQuota(49 * MB, 1 * MB + 1, 50).canUpload, false, '49 + 1MB+1B 초과 차단');
// 기존 버그 재현: used<limit 만 보던 시절엔 49.2MB 에서 2.6MB 추가가 통과 → 51.8MB(104%)
eq(evaluateQuota(Math.round(49.2 * MB), Math.round(2.6 * MB), 50).canUpload, false, '49.2 + 2.6 → 차단 (기존 104% 오버슈트 케이스)');
eq(evaluateQuota(50 * MB, 0, 50).canUpload, true, '정확히 한도 + 신규 0 → 허용(텍스트만 저장과 동일)');
eq(evaluateQuota(51 * MB, 1, 50).canUpload, false, '이미 초과 상태에서 추가 차단');
// ssyyu 실측: 실제 저장 1.6MB → 압축 사진(~0.07MB) 추가 가능
eq(evaluateQuota(Math.round(1.6 * MB), 70 * 1024, 50).canUpload, true, '실제 1.6MB 사용자 → 업로드 허용');
eq(evaluateQuota(Math.round(1.6 * MB), 0, 50).usedMB, 1.6, 'usedMB 표기 1.6');

console.log('[evaluateQuota — Plus / 무제한 / 비정상 입력]');
eq(evaluateQuota(999 * MB, 1 * MB, 1000).canUpload, true, 'Plus 999 + 1 = 1000 허용');
eq(evaluateQuota(999 * MB, 2 * MB, 1000).canUpload, false, 'Plus 999 + 2 차단');
eq(evaluateQuota(10_000 * MB, 100 * MB, 0).canUpload, true, 'limit 0 = 무제한');
eq(evaluateQuota(-5, -5, 50).usedBytes, 0, '음수 사용량 → 0 으로 보정');
eq(evaluateQuota(-5, -5, 50).incomingBytes, 0, '음수 incoming → 0 으로 보정');
eq(evaluateQuota(NaN, NaN, 50).canUpload, true, 'NaN → 0 처리');

console.log('[parseIncomingBytes]');
eq(parseIncomingBytes(null), 0, 'null → 0');
eq(parseIncomingBytes(''), 0, '빈 문자열 → 0');
eq(parseIncomingBytes('12345'), 12345, '정수');
eq(parseIncomingBytes('-1'), null, '음수 거부');
eq(parseIncomingBytes('1.5'), null, '소수 거부');
eq(parseIncomingBytes('abc'), null, '문자 거부');
eq(parseIncomingBytes('1e9'), null, '지수표기 거부');
eq(parseIncomingBytes(String(MAX_INCOMING_BYTES)), MAX_INCOMING_BYTES, '상한 정확히 허용');
eq(parseIncomingBytes(String(MAX_INCOMING_BYTES + 1)), null, '상한 초과 거부');
eq(parseIncomingBytes('99999999999999999999'), null, '안전정수 초과 거부');

console.log('[toMB]');
eq(toMB(Math.round(51.8 * MB)), 51.8, '51.8MB');
eq(toMB(0), 0, '0');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
