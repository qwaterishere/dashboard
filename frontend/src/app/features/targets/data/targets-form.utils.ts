import type { TargetsData, TargetsFormState } from '../../../shared/models/targets.model';

export function buildTargetsFormState(data: TargetsData): TargetsFormState {
  return {
    revenueMonthPlan: data.revenue.monthPlan,
    weekProfile: [...data.revenue.weekProfile],
    dailyPlanOverrides: {},
    foodcostGoals: Object.fromEntries(data.foodcost.map((unit) => [unit.key, unit.goalPct])),
    writeoffs: data.writeoffs.map((unit) => ({ ...unit })),
    complimentsGoalPct: data.compliments.goalPct,
    inventoryGoalPct: data.inventory.goalPct,
  };
}

export function complimentsAmountFromPlan(monthPlan: number, goalPct: number): number {
  return Math.round((monthPlan * goalPct) / 100);
}
