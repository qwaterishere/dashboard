/** Контракт GET /api/foodcost (backend/src/schemas/foodcost.py). */

import type { ApiPeriod } from './api-period.model';

export interface BaseCost {
  revenue: number;
  cost: number;
  revenueWithCost: number;
  prevRevenue: number | null;
  prevCost: number | null;
  prevRevenueWithCost: number | null;
}

export interface CostTotals extends BaseCost {
  goal: number | null;
}

export interface UnitCost extends BaseCost {
  key: 'k' | 'b' | 'w' | 'o';
  goal?: number | null;
}

export interface GroupCost extends BaseCost {
  unit: 'k' | 'b' | 'w' | 'o';
  group: string;
  goal?: number | null;
}

export interface DiscountFacts {
  discountSum: number;
  discountedRevenue: number;
  discountedRevenueWithCost: number;
  discountSumWithCost: number;
  discountedCost: number;
}

export interface Compliments {
  cost: number;
  priceValue: number;
  qty: number;
}

export interface StaffMeals {
  cost: number;
  paidSum: number;
  qty: number;
}

export interface LossFacts {
  compliments: Compliments;
  staff: StaffMeals;
  writeoffs: null;
  writeoffsGoal?: number | null;
  complimentsGoal?: number | null;
}

export interface FoodcostApi {
  period: ApiPeriod;
  compare: ApiPeriod;
  totals: CostTotals;
  dirty: null;
  units: UnitCost[];
  groups: GroupCost[];
  discounts: DiscountFacts;
  losses: LossFacts;
}
