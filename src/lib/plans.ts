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
}

export const PLANS: Record<PlanType, PlanConfig> = {
  free: {
    name: 'Free',
    nameKo: '무료',
    price: 0,
    maxRecords: 5,
    searchPerDay: 3,
    aiAnalysis: 'blur',
    maxSavedAnalyses: 0,
    costStatsMonths: 1,
    maxPets: 1,
    attachmentsPerRecord: 1,
  },
  basic: {
    name: 'Basic',
    nameKo: '베이직',
    price: 2900,
    maxRecords: 15,
    searchPerDay: 10,
    aiAnalysis: 'full',
    maxSavedAnalyses: 10,
    costStatsMonths: 3,
    maxPets: 3,
    attachmentsPerRecord: 3,
  },
  premium: {
    name: 'Premium',
    nameKo: '프리미엄',
    price: 4900,
    maxRecords: 0, // unlimited
    searchPerDay: 30,
    aiAnalysis: 'full',
    maxSavedAnalyses: 0, // unlimited
    costStatsMonths: 12,
    maxPets: 0, // unlimited
    attachmentsPerRecord: 5,
  },
};

export function getPlanConfig(plan: string): PlanConfig {
  if (plan in PLANS) return PLANS[plan as PlanType];
  return PLANS.free;
}
