/** Контракт GET /api/attention — зеркало backend AttentionResponse. */

export type AttentionDomainStatus = 'ready' | 'empty' | 'error' | 'insufficient';

export interface AttentionPeriod {
  year: number;
  month: number;
}

export interface AttentionDomains {
  stock: AttentionDomainStatus;
  foodcost: AttentionDomainStatus;
  revenue: AttentionDomainStatus;
  targets: AttentionDomainStatus;
}

export interface NegativeStockHint {
  count: number;
  valueAbs: number;
}

export interface FoodcostAttentionFacts {
  cleanPct: number;
  cleanGoal: number | null;
  cleanGoalConfigured: boolean;
  overGoal: boolean;
  complimentsFact: number;
  complimentsGoal: number;
  complimentsOver: boolean;
}

export interface RevenuePaceFacts {
  risk: boolean;
  fact: number;
  pace: number | null;
}

export interface MonthPlanFacts {
  configured: boolean;
}

export interface AttentionApi {
  asOf: string;
  period: AttentionPeriod;
  domains: AttentionDomains;
  negativeStock: NegativeStockHint | null;
  foodcost: FoodcostAttentionFacts | null;
  revenuePace: RevenuePaceFacts | null;
  monthPlan: MonthPlanFacts | null;
}
