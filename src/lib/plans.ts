export type PlanType = 'free' | 'basic' | 'premium';

export interface PlanConfig {
  name: string;
  nameKo: string;
  price: number;
  maxRecords: number;
  searchPerDay: number;
  aiAnalysis: 'blur' | 'full';
  maxSavedAnalyses: number;
  costStatsMonths: number;
  maxPets: number; // 0 = unlimited
  attachmentsPerRecord: number;
  maxDevices: number;
}

export const PLANS: Record<PlanType, PlanConfig> = {
  free: {
    name: 'Free',
    nameKo: '무료',
    price: 0,
    maxRecords: 10,
    searchPerDay: 3,
    aiAnalysis: 'blur',
    maxSavedAnalyses: 0,
    costStatsMonths: 1,
    maxPets: 2,
    attachmentsPerRecord: 1,
    maxDevices: 1,
  },
  basic: {
    name: 'Basic',
    nameKo: '베이직',
    price: 2900,
    maxRecords: 30,
    searchPerDay: 10,
    aiAnalysis: 'full',
    maxSavedAnalyses: 10,
    costStatsMonths: 6,
    maxPets: 3,
    attachmentsPerRecord: 3,
    maxDevices: 2,
  },
  premium: {
    name: 'Premium',
    nameKo: '프리미엄',
    price: 4900,
    maxRecords: 100,
    searchPerDay: 20,
    aiAnalysis: 'full',
    maxSavedAnalyses: 50,
    costStatsMonths: 12,
    maxPets: 5,
    attachmentsPerRecord: 5,
    maxDevices: 3,
  },
};

export function getPlanConfig(plan: string): PlanConfig {
  if (plan in PLANS) return PLANS[plan as PlanType];
  return PLANS.free;
}
