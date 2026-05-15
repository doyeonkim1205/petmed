export type PlanType = 'free' | 'plus';

export interface PlanConfig {
  name: string;
  nameKo: string;
  price: number;
  maxRecords: number;
  searchPerDay: number;
  symptomSearchPerDay: number;
  symptomRefinePerDay: number;
  aiAnalysis: 'blur' | 'full';
  maxSavedAnalyses: number;
  costStatsMonths: number;
  maxPets: number; // 0 = unlimited
  attachmentsPerRecord: number;
  maxDevices: number;
  maxStorageMB: number; // 유저별 총 저장용량 (MB), 0 = unlimited
  maxSymptomLength: number; // 증상 입력 최대 글자 수
}

export const PLANS: Record<PlanType, PlanConfig> = {
  free: {
    name: 'Free',
    nameKo: '무료',
    price: 0,
    maxRecords: 15,
    searchPerDay: 3,
    symptomSearchPerDay: 2,
    symptomRefinePerDay: 1,
    aiAnalysis: 'full',
    maxSavedAnalyses: 0,
    costStatsMonths: 3,
    maxPets: 2,
    attachmentsPerRecord: 1,
    maxDevices: 1,
    maxStorageMB: 50,
    maxSymptomLength: 200,
  },
  plus: {
    name: 'Plus',
    nameKo: '플러스',
    price: 3900, // 1회 결제 기준가. 자동 결제 3500, 연간 40000은 payment_products DB에서 관리
    maxRecords: 0,
    searchPerDay: 15,
    symptomSearchPerDay: 10,
    // 1~2회로 충분한 임상 정보 수집이 가능하도록 설계 — 4~5회 재분석은
    // AI 가 같은 질문 반복하는 경향 발견됨. 효율화 + 비용 절감.
    symptomRefinePerDay: 3,
    aiAnalysis: 'full',
    // 평균 유저는 평생 100편 내외 저장. 500편 상한은 매크로 스팸 방어용.
    // 유저가 도달하면 경고 메시지 + CS 문의로 상향 가능 (내부 규칙).
    maxSavedAnalyses: 500,
    costStatsMonths: 12,
    maxPets: 0,
    attachmentsPerRecord: 5,
    maxDevices: 3,
    maxStorageMB: 1000,
    maxSymptomLength: 500,
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
