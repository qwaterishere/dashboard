import type { PeriodGranularity, PeriodInfo } from '../models/common.model';
import type { ChartWeekRange } from '../models/chart-period.model';
import type { PeriodV2, RevenueDayV2 } from '../models/dashboard-v2.model';
import { MONTHS_SHORT } from '../constants/month-labels.constants';
import {
  enumerateIsoDateRange,
  resolveChartWeekRange,
  resolveDefaultWeekRange,
  toIsoDateString,
} from './chart-period.utils';

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

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Диапазон дат периода для шапки и подписей графиков. */
export function formatPeriodRange(p: PeriodV2): string {
  const month = MONTHS_GENITIVE[p.month - 1] ?? '';
  if (p.dayFrom === p.dayTo) {
    return `${p.dayTo} ${month} ${p.year}`;
  }
  return `${p.dayFrom}–${p.dayTo} ${month} ${p.year}`;
}

/** Подпись периода для chart period pill (сокращённые месяцы). */
export function formatChartPeriodRange(p: PeriodV2): string {
  const month = MONTHS_SHORT[p.month - 1] ?? '';
  if (p.dayFrom === p.dayTo) {
    return `${p.dayTo} ${month} ${p.year}`;
  }
  return `${p.dayFrom}–${p.dayTo} ${month} ${p.year}`;
}

export function formatIsoWeekRangeLabel(weekRange: ChartWeekRange): string {
  const start = parseIsoDate(weekRange.startDate);
  const end = parseIsoDate(weekRange.endDate);
  if (!start || !end) return '';

  if (start.year === end.year && start.month === end.month) {
    const month = MONTHS_SHORT[start.month - 1] ?? '';
    if (start.day === end.day) {
      return `${start.day} ${month} ${start.year}`;
    }
    return `${start.day}–${end.day} ${month} ${start.year}`;
  }

  const startMonth = MONTHS_SHORT[start.month - 1] ?? '';
  const endMonth = MONTHS_SHORT[end.month - 1] ?? '';
  return `${start.day} ${startMonth} – ${end.day} ${endMonth} ${start.year}`;
}

/** Подпись годового периода для period bar / chart pill. */
export function formatYearPeriodLabel(
  year: number,
  monthFrom: number,
  monthTo: number,
): string {
  const from = MONTHS_SHORT[monthFrom - 1] ?? '';
  const to = MONTHS_SHORT[monthTo - 1] ?? '';
  if (monthFrom === 1 && monthTo === 12) return String(year);
  if (monthFrom === monthTo) return `${from} ${year}`;
  return `${from}–${to} ${year}`;
}

/** Подпись периода для chart pill с учётом granularity. */
export function formatChartPeriodLabel(
  period: PeriodV2,
  granularity: PeriodGranularity,
  monthRange?: { from: number; to: number },
  weekRange?: ChartWeekRange,
): string {
  if (granularity === 'month') {
    return formatChartPeriodRange(period);
  }
  if (granularity === 'year' && monthRange) {
    return formatYearPeriodLabel(period.year, monthRange.from, monthRange.to);
  }
  const effectiveWeek =
    weekRange ?? resolveDefaultWeekRange(period.year, period.month, period.dayFrom, period.dayTo);
  return formatIsoWeekRangeLabel(effectiveWeek);
}

/** Фильтрует дни графика по granularity (данные API — месячный календарь). */
export function filterRevenueDays(
  days: RevenueDayV2[],
  period: PeriodV2,
  granularity: PeriodGranularity,
  weekRange?: ChartWeekRange,
  lookupDay?: (year: number, month: number, day: number) => RevenueDayV2 | undefined,
): RevenueDayV2[] {
  if (granularity === 'month' || granularity === 'year') {
    return days;
  }
  return buildWeekRevenueDays(days, period, weekRange, lookupDay);
}

function apiWeekday(isoDate: string): number {
  const parts = parseIsoDate(isoDate);
  if (!parts) return 1;
  return new Date(parts.year, parts.month - 1, parts.day).getDay();
}

/** Полная календарная неделя (пн–вс) с нулевыми днями для отсутствующих в API. */
export function buildWeekRevenueDays(
  days: RevenueDayV2[],
  period: PeriodV2,
  weekRange?: ChartWeekRange,
  lookupDay?: (year: number, month: number, day: number) => RevenueDayV2 | undefined,
): RevenueDayV2[] {
  const effectiveWeek =
    weekRange ?? resolveDefaultWeekRange(period.year, period.month, period.dayFrom, period.dayTo);
  const byDay = new Map(days.map((d) => [d.day, d]));
  const defaultLookup = (year: number, month: number, day: number) =>
    year === period.year && month === period.month ? byDay.get(day) : undefined;
  const resolveDay = lookupDay ?? defaultLookup;

  const isoDates = enumerateIsoDateRange(effectiveWeek.startDate, effectiveWeek.endDate);
  const spansMonths =
    effectiveWeek.startDate.slice(0, 7) !== effectiveWeek.endDate.slice(0, 7);

  return isoDates.map((iso, index) => {
    const parts = parseIsoDate(iso)!;
    const entry = resolveDay(parts.year, parts.month, parts.day);
    if (entry) return entry;

    return {
      day: spansMonths ? index + 1 : parts.day,
      weekday: apiWeekday(iso),
      revenue: 0,
      checks: 0,
      guests: 0,
      plan: null,
    };
  });
}

export function monthRangeFromSeries(months: { month: number }[]): { from: number; to: number } | null {
  if (!months.length) return null;
  return { from: months[0].month, to: months[months.length - 1].month };
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

export { resolveChartWeekRange, toIsoDateString };
