export type PlanType = 'free' | 'basic' | 'premium';

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
    aiAnalysis: 'blur',
    maxSavedAnalyses: 0,
    costStatsMonths: 1,
    maxPets: 3,
    attachmentsPerRecord: 1,
    maxDevices: 1,
    maxStorageMB: 50,
  },
  basic: {
    name: 'Basic',
    nameKo: '베이직',
    price: 3900,
    maxRecords: 100,
    searchPerDay: 10,
    symptomSearchPerDay: 5,
    symptomRefinePerDay: 3,
    aiAnalysis: 'full',
    maxSavedAnalyses: 30,
    costStatsMonths: 6,
    maxPets: 5,
    attachmentsPerRecord: 3,
    maxDevices: 2,
    maxStorageMB: 200,
  },
  premium: {
    name: 'Premium',
    nameKo: '프리미엄',
    price: 5900,
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
  },
};

export function getPlanConfig(plan: string): PlanConfig {
  if (plan in PLANS) return PLANS[plan as PlanType];
  return PLANS.free;
}
