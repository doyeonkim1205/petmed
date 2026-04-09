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
    costStatsMonths: 1,
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
    symptomRefinePerDay: 5,
    aiAnalysis: 'full',
    maxSavedAnalyses: 0,
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
