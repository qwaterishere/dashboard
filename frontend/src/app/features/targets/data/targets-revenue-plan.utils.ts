export interface MonthDayPlan {
  day: number;
  amount: number;
  isOverride: boolean;
}

/** Индекс профиля недели (пн=0 … вс=6) по календарной дате. */
export function weekProfileIndex(year: number, month: number, day: number): number {
  return (new Date(year, month - 1, day).getDay() + 6) % 7;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Смещение первого дня месяца в сетке пн–вс (пн = 0). */
export function monthGridOffset(year: number, month: number): number {
  return weekProfileIndex(year, month, 1);
}

/**
 * Распределяет план месяца по дням с учётом профиля недели.
 * Переопределённые дни фиксируются; остаток делится между остальными.
 */
export function buildMonthDayPlans(
  year: number,
  month: number,
  monthPlan: number,
  weekProfile: number[],
  overrides: Record<number, number> = {},
): MonthDayPlan[] {
  const totalDays = daysInMonth(year, month);
  const days = Array.from({ length: totalDays }, (_, index) => index + 1);

  const overrideTotal = days.reduce((sum, day) => {
    const value = overrides[day];
    return value == null ? sum : sum + value;
  }, 0);

  const remainingPlan = Math.max(0, Math.round(monthPlan) - overrideTotal);
  const freeDays = days.filter((day) => overrides[day] == null);

  const weights = freeDays.map((day) => {
    const index = weekProfileIndex(year, month, day);
    const weight = weekProfile[index];
    return Number.isFinite(weight) && weight > 0 ? weight : 1;
  });
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0) || 1;

  const distributed = distributeWithLargestRemainder(
    freeDays,
    weights,
    weightSum,
    remainingPlan,
  );

  const byDay = new Map<number, MonthDayPlan>();
  for (const day of days) {
    const override = overrides[day];
    if (override != null) {
      byDay.set(day, { day, amount: Math.round(override), isOverride: true });
    }
  }
  for (const item of distributed) {
    if (!byDay.has(item.day)) {
      byDay.set(item.day, { day: item.day, amount: item.amount, isOverride: false });
    }
  }

  return days.map((day) => byDay.get(day)!);
}

export function sumMonthDayPlans(plans: MonthDayPlan[]): number {
  return plans.reduce((sum, plan) => sum + plan.amount, 0);
}

function distributeWithLargestRemainder(
  days: number[],
  weights: number[],
  weightSum: number,
  total: number,
): { day: number; amount: number }[] {
  if (days.length === 0) {
    return [];
  }

  const raw = days.map((day, index) => ({
    day,
    raw: (total * weights[index]) / weightSum,
  }));
  const floored = raw.map((item) => ({
    day: item.day,
    amount: Math.floor(item.raw),
    fraction: item.raw - Math.floor(item.raw),
  }));

  let remainder = total - floored.reduce((sum, item) => sum + item.amount, 0);
  const order = [...floored].sort((a, b) => b.fraction - a.fraction);
  for (const item of order) {
    if (remainder <= 0) break;
    item.amount += 1;
    remainder -= 1;
  }

  return floored.map(({ day, amount }) => ({ day, amount }));
}
