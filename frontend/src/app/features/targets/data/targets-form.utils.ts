import type {
  TargetsData,
  TargetsFormState,
  TargetsUpsertRequest,
} from '../../../shared/models/targets.model';

export type TargetsFormSection =
  | 'revenue'
  | 'foodcost'
  | 'writeoffs'
  | 'compliments'
  | 'inventory';

export function buildTargetsFormState(data: TargetsData): TargetsFormState {
  const dailyPlanOverrides: Record<number, number> = {};
  for (const [key, amount] of Object.entries(data.dailyOverrides ?? {})) {
    const day = Number(key);
    if (Number.isFinite(day) && day >= 1 && day <= 31) {
      dailyPlanOverrides[day] = amount;
    }
  }

  return {
    revenueMonthPlan: data.revenue.monthPlan,
    weekProfile: [...data.revenue.weekProfile],
    dailyPlanOverrides,
    foodcostGoals: Object.fromEntries(data.foodcost.map((unit) => [unit.key, unit.goalPct])),
    writeoffs: data.writeoffs.map((unit) => ({ ...unit })),
    complimentsGoalPct: data.compliments.goalPct,
    inventoryGoalPct: data.inventory.goalPct,
  };
}

export function formStateToUpsertRequest(
  data: TargetsData,
  form: TargetsFormState,
): TargetsUpsertRequest {
  const dailyOverrides: Record<string, number> = {};
  for (const [day, amount] of Object.entries(form.dailyPlanOverrides)) {
    dailyOverrides[String(day)] = amount;
  }

  return {
    year: data.period.year,
    month: data.period.month,
    revenue: {
      monthPlan: form.revenueMonthPlan,
      weekProfile: [...form.weekProfile],
    },
    dailyOverrides,
    foodcost: data.foodcost.map((unit) => ({
      ...unit,
      goalPct: form.foodcostGoals[unit.key] ?? unit.goalPct,
    })),
    writeoffs: form.writeoffs.map((unit) => ({ ...unit })),
    complimentsGoalPct: form.complimentsGoalPct,
    inventoryGoalPct: form.inventoryGoalPct,
  };
}

export function complimentsAmountFromPlan(monthPlan: number, goalPct: number): number {
  return Math.round((monthPlan * goalPct) / 100);
}

/** Месяц считается настроенным, если сохранён положительный план выручки. */
export function isTargetsMonthConfigured(data: TargetsData): boolean {
  return isFilledPositive(data.revenue.monthPlan);
}

/** Поле считается заполненным, если это конечное число > 0. */
export function isFilledPositive(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export interface TargetsFormValidation {
  ok: boolean;
  message: string | null;
  missing: string[];
}

/**
 * Все обязательные поля формы должны быть > 0.
 * Дневные overrides необязательны.
 */
export function validateTargetsFormState(form: TargetsFormState): TargetsFormValidation {
  const missing: string[] = [];

  if (!isFilledPositive(form.revenueMonthPlan)) {
    missing.push('план выручки на месяц');
  }

  if (form.weekProfile.length !== 7 || form.weekProfile.some((w) => !isFilledPositive(w))) {
    missing.push('профиль недели (все 7 дней)');
  }

  const foodcostKeys = Object.keys(form.foodcostGoals);
  if (
    foodcostKeys.length === 0 ||
    foodcostKeys.some((key) => !isFilledPositive(form.foodcostGoals[key]))
  ) {
    missing.push('цели фудкоста по юнитам');
  }

  if (form.writeoffs.length === 0) {
    missing.push('списания');
  } else {
    for (const unit of form.writeoffs) {
      const amount = unit.mode === 'pct' ? unit.pct : unit.rub;
      if (!isFilledPositive(amount)) {
        missing.push(`списания: ${unit.name}`);
      }
    }
  }

  if (!isFilledPositive(form.complimentsGoalPct)) {
    missing.push('комплименты');
  }

  if (!isFilledPositive(form.inventoryGoalPct)) {
    missing.push('инвентаризация');
  }

  if (missing.length === 0) {
    return { ok: true, message: null, missing: [] };
  }

  return {
    ok: false,
    missing,
    message: `Заполните все поля: ${missing.join(', ')}.`,
  };
}

export function cloneTargetsFormState(state: TargetsFormState): TargetsFormState {
  return {
    revenueMonthPlan: state.revenueMonthPlan,
    weekProfile: [...state.weekProfile],
    dailyPlanOverrides: { ...state.dailyPlanOverrides },
    foodcostGoals: { ...state.foodcostGoals },
    writeoffs: state.writeoffs.map((unit) => ({ ...unit })),
    complimentsGoalPct: state.complimentsGoalPct,
    inventoryGoalPct: state.inventoryGoalPct,
  };
}

export function isTargetsFormDirty(current: TargetsFormState, saved: TargetsFormState): boolean {
  return (
    isTargetsSectionDirty(current, saved, 'revenue') ||
    isTargetsSectionDirty(current, saved, 'foodcost') ||
    isTargetsSectionDirty(current, saved, 'writeoffs') ||
    isTargetsSectionDirty(current, saved, 'compliments') ||
    isTargetsSectionDirty(current, saved, 'inventory')
  );
}

export function isTargetsSectionDirty(
  current: TargetsFormState,
  saved: TargetsFormState,
  section: TargetsFormSection,
): boolean {
  switch (section) {
    case 'revenue':
      return (
        current.revenueMonthPlan !== saved.revenueMonthPlan ||
        !sameNumberList(current.weekProfile, saved.weekProfile) ||
        !sameNumberRecord(current.dailyPlanOverrides, saved.dailyPlanOverrides)
      );
    case 'foodcost':
      return !sameNumberRecord(current.foodcostGoals, saved.foodcostGoals);
    case 'writeoffs':
      return JSON.stringify(current.writeoffs) !== JSON.stringify(saved.writeoffs);
    case 'compliments':
      return current.complimentsGoalPct !== saved.complimentsGoalPct;
    case 'inventory':
      return current.inventoryGoalPct !== saved.inventoryGoalPct;
  }
}

export function restoreTargetsSection(
  current: TargetsFormState,
  saved: TargetsFormState,
  section: TargetsFormSection,
): TargetsFormState {
  const next = cloneTargetsFormState(current);
  switch (section) {
    case 'revenue':
      next.revenueMonthPlan = saved.revenueMonthPlan;
      next.weekProfile = [...saved.weekProfile];
      next.dailyPlanOverrides = { ...saved.dailyPlanOverrides };
      break;
    case 'foodcost':
      next.foodcostGoals = { ...saved.foodcostGoals };
      break;
    case 'writeoffs':
      next.writeoffs = saved.writeoffs.map((unit) => ({ ...unit }));
      break;
    case 'compliments':
      next.complimentsGoalPct = saved.complimentsGoalPct;
      break;
    case 'inventory':
      next.inventoryGoalPct = saved.inventoryGoalPct;
      break;
  }
  return next;
}

function sameNumberList(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function sameNumberRecord(a: Record<number | string, number>, b: Record<number | string, number>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
}
