import type { PeriodGranularity, PeriodInfo } from '../models/common.model';
import type { PeriodV2 } from '../models/dashboard-v2.model';

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

const MONTHS_INSTRUMENTAL = [
  'январём',
  'февралём',
  'мартом',
  'апрелем',
  'маем',
  'июнем',
  'июлем',
  'августом',
  'сентябрём',
  'октябрём',
  'ноябрём',
  'декабрём',
] as const;

/** Диапазон дат периода для шапки и подписей графиков. */
export function formatPeriodRange(p: PeriodV2): string {
  const month = MONTHS_GENITIVE[p.month - 1] ?? '';
  if (p.dayFrom === p.dayTo) {
    return `${p.dayTo} ${month} ${p.year}`;
  }
  return `${p.dayFrom}–${p.dayTo} ${month} ${p.year}`;
}

/** Подпись периода для chart pill с учётом granularity. */
export function formatChartPeriodLabel(
  period: PeriodV2,
  granularity: PeriodGranularity,
): string {
  if (granularity === 'month') {
    return formatPeriodRange(period);
  }
  const fromDay = Math.max(period.dayFrom, period.dayTo - 6);
  return formatPeriodRange({ ...period, dayFrom: fromDay });
}

/** Фильтрует дни графика по granularity (данные API — месячный календарь). */
export function filterRevenueDays<T extends { day: number }>(
  days: T[],
  period: PeriodV2,
  granularity: PeriodGranularity,
): T[] {
  if (granularity === 'month' || granularity === 'year') {
    return days;
  }
  const fromDay = Math.max(period.dayFrom, period.dayTo - 6);
  return days.filter((d) => d.day >= fromDay && d.day <= period.dayTo);
}

/** Подпись LfL-сравнения («июнем 2025»). */
export function formatCompareWith(p: PeriodV2): string {
  const month = MONTHS_INSTRUMENTAL[p.month - 1] ?? '';
  return `${month} ${p.year}`;
}

/** PeriodInfo для period bar из фактов API dashboard v2. */
export function buildPeriodInfo(period: PeriodV2, compare: PeriodV2): PeriodInfo {
  return {
    label: formatPeriodRange(period),
    note: 'закрытые дни',
    compareWith: formatCompareWith(compare),
  };
}
