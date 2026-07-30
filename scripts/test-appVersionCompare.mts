// 실행: node --experimental-strip-types scripts/test-appVersionCompare.mts
import { compareBuild, decideUpdate, isValidUpdateConfig, parseBuildSegments } from '../src/lib/appVersionCompare.ts';

let pass = 0, fail = 0;
function eq(actual: unknown, expected: unknown, name: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; }
  else { fail++; console.log(`  ✗ ${name}  expected=${JSON.stringify(expected)} got=${JSON.stringify(actual)}`); }
}

console.log('[compareBuild]');
eq(compareBuild('9', '10'), -1, '"9" < "10" (숫자 비교)');
eq(compareBuild('10', '9'), 1, '"10" > "9"');
eq(compareBuild('43', '43'), 0, '"43" == "43"');
eq(compareBuild('1.0.9', '1.0.10'), -1, '"1.0.9" < "1.0.10" (세그먼트)');
eq(compareBuild('1.0', '1.0.0'), 0, '"1.0" == "1.0.0" (0 패딩)');
eq(compareBuild(' 43 ', '43'), 0, '" 43 " == "43" (공백 trim)');
eq(compareBuild('01', '1'), 0, '"01" == "1" (leading zero)');
eq(compareBuild('1.', '1.0'), null, '"1." → null (trailing dot)');
eq(compareBuild('1..0', '1.0'), null, '"1..0" → null (빈 세그먼트)');
eq(compareBuild('1.0-beta', '1.0'), null, '"1.0-beta" → null (문자 포함)');
eq(compareBuild('', '10'), null, '"" → null (빈 값)');
eq(compareBuild('abc', '10'), null, '"abc" → null (문자)');
eq(compareBuild('1234567890', '1'), null, '10자리 → null (자릿수 상한)');
eq(compareBuild('999999999', '1'), 1, '9자리(999999999) → 유효, > "1"');
eq(parseBuildSegments('  '), null, 'parseBuildSegments("  ") → null');

console.log('[decideUpdate]');
eq(decideUpdate('43', { enabled: true, latestBuild: '43', minSupportedBuild: null }), 'none', '설치==latest → none');
eq(decideUpdate('42', { enabled: true, latestBuild: '43', minSupportedBuild: null }), 'soft', '설치<latest → soft');
eq(decideUpdate('44', { enabled: true, latestBuild: '43', minSupportedBuild: null }), 'none', '설치>latest → none');
eq(decideUpdate('39', { enabled: true, latestBuild: '43', minSupportedBuild: '40' }), 'force', '설치<min → force');
eq(decideUpdate('41', { enabled: true, latestBuild: '43', minSupportedBuild: '40' }), 'soft', 'min<=설치<latest → soft');
eq(decideUpdate('42', { enabled: false, latestBuild: '43', minSupportedBuild: null }), 'none', 'enabled=false → none');
eq(decideUpdate('42', { enabled: true, latestBuild: '50', minSupportedBuild: '60' }), 'none', 'min>latest 오설정 → none (force 아님)');
eq(decideUpdate('42', { enabled: true, latestBuild: null, minSupportedBuild: null }), 'none', 'latest 없음 → none');
eq(decideUpdate('abc', { enabled: true, latestBuild: '43', minSupportedBuild: null }), 'none', '설치 비정상 → none (fail-open)');
eq(decideUpdate('42', { enabled: true, latestBuild: 'x', minSupportedBuild: null }), 'none', 'latest 비정상 → none (fail-open)');

console.log('[isValidUpdateConfig]');
const androidOk = { latest_build: '43', min_supported_build: null, store_url: 'https://play.google.com/store/apps/details?id=com.dylabs.pawdex', reminder_days: 7 };
eq(isValidUpdateConfig('android', androidOk), true, 'android 정상 설정');
eq(isValidUpdateConfig('android', { ...androidOk, store_url: 'https://evil.example.com/x' }), false, '비공식 store_url → false');
eq(isValidUpdateConfig('android', { ...androidOk, store_url: 'https://apps.apple.com/app/id1' }), false, 'android 인데 apple url → false');
eq(isValidUpdateConfig('android', { ...androidOk, reminder_days: 0 }), false, 'reminder_days<1 → false');
eq(isValidUpdateConfig('android', { ...androidOk, latest_build: '44', min_supported_build: '50' }), false, 'min>latest → false');
eq(isValidUpdateConfig('android', { ...androidOk, latest_build: '1.0-beta' }), false, '비정상 build → false');
eq(isValidUpdateConfig('ios', { latest_build: '10', min_supported_build: null, store_url: 'https://apps.apple.com/app/id000000000', reminder_days: 7 }), true, 'ios 정상 설정');

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
