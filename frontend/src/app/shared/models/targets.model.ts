import type { CategoryKey } from './common.model';

export type TargetsWriteoffMode = 'pct' | 'rub';

export interface TargetsPeriod {
  year: number;
  month: number;
  label: string;
}

export interface TargetsReference {
  label: string;
  revenueFact: number;
  revenuePace: number;
}

export interface TargetsRevenue {
  monthPlan: number;
  weekProfile: number[];
}

export interface TargetsFoodcostUnit {
  key: CategoryKey;
  name: string;
  goalPct: number;
  factPct: number;
}

export interface TargetsWriteoffUnit {
  key: CategoryKey;
  name: string;
  mode: TargetsWriteoffMode;
  pct: number;
  rub: number;
}

export interface TargetsCompliments {
  goalPct: number;
  factPct: number;
  factRub: number;
}

export interface TargetsInventory {
  goalPct: number;
  note: string;
}

export interface TargetsData {
  period: TargetsPeriod;
  reference: TargetsReference;
  revenue: TargetsRevenue;
  /** Дневные override: ключ — день месяца ("1"…"31"). */
  dailyOverrides: Record<string, number>;
  foodcost: TargetsFoodcostUnit[];
  writeoffs: TargetsWriteoffUnit[];
  compliments: TargetsCompliments;
  inventory: TargetsInventory;
  /** Редактирование заблокировано — снятие только в Настройках. */
  locked: boolean;
}

export interface TargetsLockedPeriod {
  year: number;
  month: number;
  label: string;
}

export interface TargetsLockedList {
  items: TargetsLockedPeriod[];
}

export interface TargetsUpsertRequest {
  year: number;
  month: number;
  revenue: TargetsRevenue;
  dailyOverrides: Record<string, number>;
  foodcost: TargetsFoodcostUnit[];
  writeoffs: TargetsWriteoffUnit[];
  complimentsGoalPct: number;
  inventoryGoalPct: number;
}

export interface TargetsFormState {
  revenueMonthPlan: number;
  weekProfile: number[];
  dailyPlanOverrides: Record<number, number>;
  foodcostGoals: Record<string, number>;
  writeoffs: TargetsWriteoffUnit[];
  complimentsGoalPct: number;
  inventoryGoalPct: number;
}
