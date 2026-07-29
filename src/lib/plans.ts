export type PlanType = 'free' | 'plus';

export interface PlanConfig {
  name: string;
  nameKo: string;
  price: number;
  maxRecords: number;
  searchPerDay: number;
  symptomSearchPerDay: number;
  symptomRefinePerDay: number;
  photoAnalysisPerDay: number;
  /** 사진 분석 — Free 유저 평생 체험 횟수. Plus 는 photoAnalysisPerDay 사용. */
  photoAnalysisLifetimeFree: number;
  aiAnalysis: 'blur' | 'full';
  maxSavedAnalyses: number;
  costStatsMonths: number;
  maxPets: number; // 0 = unlimited
  // 검사 기록(lab_tests) 계정 전체 보관 한도. 0 = 무제한.
  // ⚠️ authoritative 는 서버 RPC(lab_test_usage/create_lab_test) — 이 값은 UI 표시/폴백용.
  //    화면 used/limit 은 서버 반환값을 우선(SQL↔TS drift 방지).
  maxLabTestsPerAccount: number;
  attachmentsPerRecord: number;
  maxDevices: number;
  maxStorageMB: number; // 유저별 총 저장용량 (MB), 0 = unlimited
  maxSymptomLength: number; // 증상 입력 최대 글자 수
  petContextAnalysis: boolean; // 펫 의료정보(나이·체중·품종·만성질환) 반영 맞춤 분석 — true=Plus 전용
  // 논문검색·증상분석 한도 창. 'month'=월 단위(무료), 'day'=일 단위(Plus).
  // ⚠️ 재분석(refine)·사진 분석은 이 창과 무관하게 각자 고정 — refine=일일, 사진=평생/일일.
  limitWindow: 'day' | 'month';
}

export const PLANS: Record<PlanType, PlanConfig> = {
  free: {
    name: 'Free',
    nameKo: '무료',
    price: 0,
    maxRecords: 0, // 무제한 — 기록은 retention(데이터 묶어두기)용, 수익화 레버 아님. 저장용량(maxStorageMB)으로 비용 방어.
    // 아래 searchPerDay/symptomSearchPerDay 는 limitWindow='month' 라 "월 한도"로 해석됨.
    searchPerDay: 5,        // 논문 검색 5회/월 (Plus 대비 optics ↑, 실측상 무료 유저 최대 사용 1~2회라 영향 0)
    symptomSearchPerDay: 5, // 증상 분석 5회/월
    symptomRefinePerDay: 1,  // 재분석은 일일 1회 (limitWindow 무관, 항상 일일)
    photoAnalysisPerDay: 0,
    // Free 유저는 평생 1회 사진 분석 체험 가능 — 가치 검증 후 Plus 전환 유도.
    photoAnalysisLifetimeFree: 1,
    aiAnalysis: 'full',
    maxSavedAnalyses: 0,
    costStatsMonths: 3,
    maxPets: 5,
    maxLabTestsPerAccount: 3, // 무료 맛보기 — 계정 전체 3건 보관
    attachmentsPerRecord: 1,
    maxDevices: 1,
    maxStorageMB: 50,
    maxSymptomLength: 200,
    petContextAnalysis: false, // 무료 = 종(강아지/고양이)만 반영한 일반 분석
    limitWindow: 'month', // 무료 = 논문·증상 월 한도
  },
  plus: {
    name: 'Plus',
    nameKo: '플러스',
    price: 3900, // 월간 기준가(단건=자동 동일 3900). 연간 40000은 payment_products DB에서 관리
    maxRecords: 0,
    searchPerDay: 10,
    symptomSearchPerDay: 10,
    // 1~2회로 충분한 임상 정보 수집이 가능하도록 설계 — 4~5회 재분석은
    // AI 가 같은 질문 반복하는 경향 발견됨. 효율화 + 비용 절감.
    symptomRefinePerDay: 3,
    // 사진 분석은 Vision API 비용이 텍스트 대비 높음 (~5배). 일일 3회면
    // 동일 증상 다각도 확인 + 새 증상 1회 정도가 가능한 적정 한도.
    photoAnalysisPerDay: 3,
    // Plus 는 일일 한도만 적용 (lifetime 의미 없음).
    photoAnalysisLifetimeFree: 0,
    aiAnalysis: 'full',
    // 평균 유저는 평생 100편 내외 저장. 500편 상한은 매크로 스팸 방어용.
    // 유저가 도달하면 경고 메시지 + CS 문의로 상향 가능 (내부 규칙).
    maxSavedAnalyses: 500,
    // 999 = 사실상 무제한. 통계 페이지가 "전체" / "직접 선택" 옵션을 lock 해제하는 데 사용.
    // 비교표는 plan === 'plus' 분기로 "전체 (제한 없음)" 표시.
    costStatsMonths: 999,
    // 무제한 → 10 (악용 방어). 일반 가구 평균 1-3마리, 5마리 넘는 다묘 가구도 드뭄.
    // 한 사용자가 100마리 등록해서 storage/AI 컨텍스트 우회하는 케이스 차단.
    maxPets: 0, // 무제한
    maxLabTestsPerAccount: 0, // 무제한
    attachmentsPerRecord: 5,
    maxDevices: 3,
    maxStorageMB: 1000,
    maxSymptomLength: 500,
    petContextAnalysis: true, // Plus = 우리 아이 의료정보 반영 맞춤 분석
    limitWindow: 'day', // Plus = 논문·증상 일일 한도
  },
};

export function getPlanConfig(plan: string): PlanConfig {
  if (plan in PLANS) return PLANS[plan as PlanType];
  return PLANS.free;
}

// ─── Trial period ────────────────────────────────────────────────
// 비공개 테스트 3주 기간 동안 모든 유저에게 Plus 기능 무료 오픈.
// 종료 시점 (KST 자정 기준) 지나면 자동으로 원래 플랜으로 복귀.
// 실제 결제한 plus 유저는 DB 에 plan='plus' 라서 트라이얼 종료 후에도 plus 유지.
const TRIAL_UNTIL_ISO = '2026-05-13T23:59:59+09:00';

export function isTrialActive(): boolean {
  return new Date() < new Date(TRIAL_UNTIL_ISO);
}

/**
 * 트라이얼 중엔 free 유저도 plus 로 취급. 실제 결제한 plus 는 항상 plus.
 * 모든 플랜 한도 체크 지점에서 profile.plan 대신 이걸 써야 트라이얼 반영됨.
 */
export function getEffectivePlan(profilePlan: string | undefined | null): 'free' | 'plus' {
  if (profilePlan === 'plus') return 'plus';
  if (isTrialActive()) return 'plus';
  return 'free';
}

/**
 * 트라이얼 종료까지 남은 일수 (UI 표시용).
 */
export function trialDaysLeft(): number {
  const now = new Date();
  const end = new Date(TRIAL_UNTIL_ISO);
  if (now >= end) return 0;
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 트라이얼 종료일 (ISO) — 안내 카드에 표시용.
 */
export function trialEndDate(): string {
  return TRIAL_UNTIL_ISO;
}
