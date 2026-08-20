// 실행: node --experimental-strip-types scripts/test-push-notifications.mts
//
// push-notifications cron 의 두 로직을 검증한다:
//   (A) 복약 회차(dose) 단위 알림 억제
//   (B) 예약 알림 본문 = 예약 메모 → 병원명 → 간결 폴백 (지난 진료 title 제외)
//
// ⚠️ 아래 함수들은 src/app/api/cron/push-notifications/route.ts 의 로직을 그대로 미러링한 것.
//    route 는 Next App Router route 파일이라 임의 export 가 위험 → 여기에 동일 로직을 복제해 검증.
//    route 수정 시 이 파일도 함께 맞출 것.

type Lang = 'ko' | 'en';

const RECORD_TITLE_MAX = 25;

// ── route 미러: truncate ──
function truncate(text: string | null | undefined, maxLen: number, fallback: string): string {
  const t = (text || '').trim();
  if (!t) return fallback;
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - 1) + '…';
}

// ── route 미러: parseDoseCount ──
function parseDoseCount(frequency: string): number {
  if (frequency.includes('3회')) return 3;
  if (frequency.includes('2회')) return 2;
  return 1;
}

// ── route 미러: 복약 매칭(1차 패스) ──
function matchMed(
  alarm_times: string[],
  frequency: string,
  currentHour: string,
  currentMinute: number,
): { doseNumbers: number[]; suppressible: boolean } {
  const doseNumbers: number[] = [];
  alarm_times.forEach((t, idx) => {
    const [h, m] = t.split(':').map(Number);
    if (String(h).padStart(2, '0') === currentHour && m === currentMinute) doseNumbers.push(idx);
  });
  const suppressible = alarm_times.length === parseDoseCount(frequency);
  return { doseNumbers, suppressible };
}

// ── route 미러: 억제 결정 (true=알림 스킵) ──
function shouldSuppress(
  suppressible: boolean,
  doseNumbers: number[],
  medId: string,
  checkedDoseKeys: Set<string>,
): boolean {
  return suppressible && doseNumbers.every((dn) => checkedDoseKeys.has(`${medId}:${dn}`));
}

// ── route 미러: buildScheduleMessage (예약/퇴원) ──
function apptLabelOf(a: { reason: string | null; hospital: string | null }): string | null {
  const s = (a.reason && a.reason.trim()) || (a.hospital && a.hospital.trim()) || '';
  return s || null;
}

function buildScheduleMessage(
  petName: string,
  appts: Array<{ id: string; title: string; reason: string | null; hospital: string | null }>,
  dischs: Array<{ id: string; title: string }>,
  locale: Lang,
): { title: string; body: string; category: 'appointment' | 'hospitalization' } {
  const apptCount = appts.length;
  const dischCount = dischs.length;
  const en = locale === 'en';
  const fb = en ? 'schedule' : '일정';

  const apptIds = new Set(appts.map((a) => a.id));
  const sameRecord = dischs.find((d) => apptIds.has(d.id));

  if (apptCount === 1 && dischCount === 1 && sameRecord) {
    const t = truncate(sameRecord.title, RECORD_TITLE_MAX, fb);
    return {
      title: en ? `🏥 ${petName}'s schedule today` : `🏥 오늘 ${petName} 일정`,
      body: en ? `"${t}" has an appointment & discharge` : `"${t}" 예약·퇴원이 있어요`,
      category: 'hospitalization',
    };
  }

  if (apptCount === 0 && dischCount > 0) {
    if (dischCount === 1) {
      const t = truncate(dischs[0].title, RECORD_TITLE_MAX, fb);
      return {
        title: en ? `🏥 ${petName}'s discharge today` : `🏥 오늘 ${petName} 퇴원`,
        body: en ? `"${t}" is scheduled for discharge` : `"${t}" 퇴원 예정이에요`,
        category: 'hospitalization',
      };
    }
    return {
      title: en ? `🏥 ${petName}'s discharge today` : `🏥 오늘 ${petName} 퇴원`,
      body: en ? `${dischCount} discharges` : `퇴원 ${dischCount}건이 있어요`,
      category: 'hospitalization',
    };
  }

  if (dischCount === 0 && apptCount > 0) {
    const titleOne = en ? `📅 ${petName}'s appointment today` : `📅 오늘 ${petName} 예약`;
    const titleMany = en ? `📅 ${petName}'s appointments today` : `📅 오늘 ${petName} 예약`;
    if (apptCount === 1) {
      const label = apptLabelOf(appts[0]);
      const body = label
        ? (en ? `"${truncate(label, RECORD_TITLE_MAX, fb)}" is scheduled` : `"${truncate(label, RECORD_TITLE_MAX, fb)}" 일정이 있어요`)
        : (en ? 'You have an appointment today' : '오늘 예약이 있어요');
      return { title: titleOne, body, category: 'appointment' };
    }
    if (apptCount === 2) {
      const la = apptLabelOf(appts[0]);
      const lb = apptLabelOf(appts[1]);
      const body = la && lb
        ? (en ? `"${truncate(la, 12, fb)}", "${truncate(lb, 12, fb)}" are scheduled` : `"${truncate(la, 12, fb)}", "${truncate(lb, 12, fb)}" 일정이 있어요`)
        : (en ? '2 appointments today' : '예약 2건이 있어요');
      return { title: titleMany, body, category: 'appointment' };
    }
    return {
      title: titleMany,
      body: en ? `${apptCount} appointments` : `예약 ${apptCount}건이 있어요`,
      category: 'appointment',
    };
  }

  return {
    title: en ? `🏥 ${petName}'s schedule today` : `🏥 오늘 ${petName} 일정`,
    body: en ? `${apptCount} appointment(s), ${dischCount} discharge(s)` : `예약 ${apptCount}건, 퇴원 ${dischCount}건 있어요`,
    category: 'hospitalization',
  };
}

// ─────────────────────────── 테스트 러너 ───────────────────────────
let pass = 0, fail = 0;
function eq(actual: unknown, expected: unknown, name: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; }
  else { fail++; console.log(`  ✗ ${name}\n      expected=${JSON.stringify(expected)}\n      got     =${JSON.stringify(actual)}`); }
}
const appt = (id: string, title: string, reason: string | null, hospital: string | null) => ({ id, title, reason, hospital });

// ═══════════════ (A) 복약 회차 단위 억제 ═══════════════
console.log('[A. 복약 매칭 + 억제]');

// 1일 3회, 알람 3개 → 매칭 인덱스 & suppressible
{
  const m = matchMed(['08:00', '13:00', '20:00'], '1일 3회', '13', 0);
  eq(m, { doseNumbers: [1], suppressible: true }, '3회약 13:00 → dose[1], suppressible');
}
// 미매칭 시각
{
  const m = matchMed(['08:00', '13:00', '20:00'], '1일 3회', '13', 30);
  eq(m.doseNumbers, [], '3회약 13:30 → 매칭 없음');
}
// 정렬 안 된 alarm_times 도 원본 인덱스 유지 (체크리스트 dose_number 와 일치)
{
  const m = matchMed(['21:00', '09:00'], '1일 2회', '09', 0);
  eq(m, { doseNumbers: [1], suppressible: true }, '비정렬 알람 09:00 → dose[1] (원본 인덱스)');
}
// 길이 불일치 → suppressible=false (fail-safe: 억제 안 함)
{
  const m = matchMed(['09:00'], '1일 3회', '09', 0);
  eq(m.suppressible, false, '알람1개인데 빈도 3회 → suppressible=false');
}
// 같은 시각 중복 → 매칭 인덱스 여러 개
{
  const m = matchMed(['13:00', '13:00'], '1일 2회', '13', 0);
  eq(m.doseNumbers, [0, 1], '중복 13:00 → dose[0,1]');
}

// 억제 결정
{
  const checked = new Set<string>(['med1:1']);
  // suppressible + 매칭회차(1) 체크됨 → 억제(스킵)
  eq(shouldSuppress(true, [1], 'med1', checked), true, '회차 체크됨 → 억제');
}
{
  const checked = new Set<string>(['med1:0']); // 아침(0)만 체크, 점심(1)은 미체크
  eq(shouldSuppress(true, [1], 'med1', checked), false, '아침만 체크·점심분 매칭 → 발송');
}
{
  const checked = new Set<string>(); // 아무것도 안 체크
  eq(shouldSuppress(true, [1], 'med1', checked), false, '미체크 → 발송');
}
{
  const checked = new Set<string>(['med1:0', 'med1:1']);
  // suppressible=false 면 아무리 체크돼도 발송 (fail-safe)
  eq(shouldSuppress(false, [1], 'med1', checked), false, 'suppressible=false → 항상 발송');
}
{
  // 중복시각 [0,1] 중 하나만 체크 → every 실패 → 발송
  const checked = new Set<string>(['med1:0']);
  eq(shouldSuppress(true, [0, 1], 'med1', checked), false, '중복시각 일부만 체크 → 발송');
  const checked2 = new Set<string>(['med1:0', 'med1:1']);
  eq(shouldSuppress(true, [0, 1], 'med1', checked2), true, '중복시각 전부 체크 → 억제');
}

// 통합: 펫 단위 뭉침에서 일부 억제 시나리오 (2약 동시각, 하나만 체크)
{
  const currentHour = '12', currentMinute = 30;
  const checked = new Set<string>(['medA:0']); // A는 체크, B는 미체크
  const meds = [
    { id: 'medA', name: '타이레놀', alarm_times: ['12:30'], frequency: '1일 1회' },
    { id: 'medB', name: '비타민', alarm_times: ['12:30'], frequency: '1일 1회' },
  ];
  const remaining: string[] = [];
  for (const med of meds) {
    const { doseNumbers, suppressible } = matchMed(med.alarm_times, med.frequency, currentHour, currentMinute);
    if (doseNumbers.length === 0) continue;
    if (shouldSuppress(suppressible, doseNumbers, med.id, checked)) continue;
    remaining.push(med.name);
  }
  eq(remaining, ['비타민'], '동시각 2약 중 체크된 것만 빠지고 미체크만 알림');
}
{
  // 둘 다 체크 → 남는 약 0 → 펫 알림 자체가 안 뜸
  const checked = new Set<string>(['medA:0', 'medB:0']);
  const meds = [
    { id: 'medA', name: '타이레놀', alarm_times: ['12:30'], frequency: '1일 1회' },
    { id: 'medB', name: '비타민', alarm_times: ['12:30'], frequency: '1일 1회' },
  ];
  const remaining: string[] = [];
  for (const med of meds) {
    const { doseNumbers, suppressible } = matchMed(med.alarm_times, med.frequency, '12', 30);
    if (doseNumbers.length === 0) continue;
    if (shouldSuppress(suppressible, doseNumbers, med.id, checked)) continue;
    remaining.push(med.name);
  }
  eq(remaining.length, 0, '동시각 전부 체크 → 알림 0');
}

// ═══════════════ (B) 예약 알림 본문 ═══════════════
console.log('[B. buildScheduleMessage 예약 본문]');

// 메모 있음 → 메모 사용
eq(
  buildScheduleMessage('콩이', [appt('r1', '지난 혈액검사 결과', '재검사·혈액수치 확인', '이해피동물병원')], [], 'ko').body,
  '"재검사·혈액수치 확인" 일정이 있어요',
  '메모 있으면 메모 (지난 title 무시)',
);
// 메모 없고 병원명 있음 → 병원명
eq(
  buildScheduleMessage('콩이', [appt('r1', '지난 혈액검사 결과', null, '이해피동물병원')], [], 'ko').body,
  '"이해피동물병원" 일정이 있어요',
  '메모 없으면 병원명',
);
// 메모·병원명 둘 다 없음 → 간결 폴백 (title 안 씀)
eq(
  buildScheduleMessage('콩이', [appt('r1', '지난 혈액검사 결과', null, null)], [], 'ko').body,
  '오늘 예약이 있어요',
  '메모·병원명 없으면 간결 폴백 (지난 title 미노출)',
);
// 빈 문자열/공백 메모 → 병원명으로
eq(
  buildScheduleMessage('콩이', [appt('r1', 't', '   ', '해피병원')], [], 'ko').body,
  '"해피병원" 일정이 있어요',
  '공백 메모는 병원명으로 폴백',
);
// 제목줄은 항상 "오늘 [펫] 예약"
eq(
  buildScheduleMessage('콩이', [appt('r1', 't', null, null)], [], 'ko').title,
  '📅 오늘 콩이 예약',
  '제목줄 = 오늘 펫 예약',
);
// 2건 둘 다 라벨 → 나열
eq(
  buildScheduleMessage('콩이', [appt('r1', 't1', '재검사', null), appt('r2', 't2', null, '해피병원')], [], 'ko').body,
  '"재검사", "해피병원" 일정이 있어요',
  '2건 둘 다 라벨 → 나열',
);
// 2건 중 하나 라벨 없음 → 건수 폴백
eq(
  buildScheduleMessage('콩이', [appt('r1', 't1', '재검사', null), appt('r2', 't2', null, null)], [], 'ko').body,
  '예약 2건이 있어요',
  '2건 중 하나 라벨 없음 → 건수',
);
// 3건 → 건수
eq(
  buildScheduleMessage('콩이', [appt('r1', 't1', 'a', null), appt('r2', 't2', 'b', null), appt('r3', 't3', 'c', null)], [], 'ko').body,
  '예약 3건이 있어요',
  '3건 → 건수',
);
// 긴 메모 truncate (25자)
{
  const longMemo = '가나다라마바사아자차카타파하가나다라마바사아자차카타파하';
  const body = buildScheduleMessage('콩이', [appt('r1', 't', longMemo, null)], [], 'ko').body;
  eq(body.length <= '"'.length * 2 + 25 + ' 일정이 있어요'.length, true, '긴 메모 25자 truncate');
}
// EN 로케일 — 메모/폴백
eq(
  buildScheduleMessage('Coco', [appt('r1', 'past', 'Re-check bloodwork', null)], [], 'en').body,
  '"Re-check bloodwork" is scheduled',
  'EN 메모',
);
eq(
  buildScheduleMessage('Coco', [appt('r1', 'past', null, null)], [], 'en').body,
  'You have an appointment today',
  'EN 폴백',
);

// 퇴원(discharge)은 title 그대로 유지 — 회귀 방어
eq(
  buildScheduleMessage('콩이', [], [{ id: 'd1', title: '입원 경과 기록' }], 'ko').body,
  '"입원 경과 기록" 퇴원 예정이에요',
  '퇴원은 title 유지 (메모 변경 영향 없음)',
);
// 같은 record 예약+퇴원 통합 → title 유지
eq(
  buildScheduleMessage('콩이', [appt('x1', '입원 기록', '재검사', '병원')], [{ id: 'x1', title: '입원 기록' }], 'ko').body,
  '"입원 기록" 예약·퇴원이 있어요',
  '예약+퇴원 동일 record → title 유지',
);

console.log(`\n${fail === 0 ? '✅' : '❌'} push-notifications: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
