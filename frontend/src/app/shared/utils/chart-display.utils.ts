import type { ChartDisplayMode, PeriodGranularity } from '../models/common.model';
import type { ChartWeekRange } from '../models/chart-period.model';
import type { PeriodV2, RevenueDayV2, RevenueMonthV2 } from '../models/dashboard-v2.model';
import type { RevenueDay } from '../models/dashboard.model';
import {
  enumerateIsoDateRange,
  listWeekRangesInMonth,
} from './chart-period.utils';
import { MONTHS_SHORT } from '../constants/month-labels.constants';
import { buildWeekRevenueDays, formatIsoWeekRangeLabel } from './period-format.utils';

export interface ChartSeriesInput {
  daily: RevenueDayV2[];
  monthly: RevenueMonthV2[];
  period: PeriodV2;
  timeframe: PeriodGranularity;
  weekRange?: ChartWeekRange;
  weekDayLookup?: (year: number, month: number, day: number) => RevenueDayV2 | undefined;
}

function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function toRevenueDay(
  day: number,
  revenue: number,
  checks: number,
  guests: number,
  plan: number | null,
  barLabel?: string,
  weekday = 1,
): RevenueDay {
  return {
    day,
    weekday,
    revenue,
    plan,
    checks,
    guests,
    avg: checks ? revenue / checks : 0,
    barLabel,
  };
}

function sumDays(days: RevenueDayV2[]): { revenue: number; checks: number; guests: number } {
  return days.reduce(
    (acc, day) => ({
      revenue: acc.revenue + day.revenue,
      checks: acc.checks + day.checks,
      guests: acc.guests + day.guests,
    }),
    { revenue: 0, checks: 0, guests: 0 },
  );
}

function buildDaySeries(input: ChartSeriesInput): RevenueDay[] {
  const weekRange = input.weekRange;

  const daily =
    input.timeframe === 'week'
      ? buildWeekRevenueDays(
          input.daily,
          input.period,
          weekRange,
          input.weekDayLookup,
        )
      : input.daily.filter((d) => d.day >= input.period.dayFrom && d.day <= input.period.dayTo);

  return daily.map((d) =>
    toRevenueDay(d.day, d.revenue, d.checks, d.guests, d.plan, undefined, d.weekday),
  );
}

function buildWeekSeries(input: ChartSeriesInput): RevenueDay[] {
  if (input.timeframe === 'week') {
    const days = buildWeekRevenueDays(
      input.daily,
      input.period,
      input.weekRange,
      input.weekDayLookup,
    );
    const totals = sumDays(days);
    const label = input.weekRange
      ? formatIsoWeekRangeLabel(input.weekRange)
      : `${input.period.dayFrom}–${input.period.dayTo}`;
    return [toRevenueDay(1, totals.revenue, totals.checks, totals.guests, null, label)];
  }

  const weeks = listWeekRangesInMonth(input.period.year, input.period.month, null);
  const byDay = new Map(input.daily.map((d) => [d.day, d]));

  return weeks.map((week, index) => {
    const slice: RevenueDayV2[] = [];
    for (const iso of enumerateIsoDateRange(week.startDate, week.endDate)) {
      const parts = parseIsoDate(iso);
      if (!parts) continue;
      if (parts.year === input.period.year && parts.month === input.period.month) {
        const entry = byDay.get(parts.day);
        if (entry) slice.push(entry);
      }
    }
    const totals = sumDays(slice);
    return toRevenueDay(
      index + 1,
      totals.revenue,
      totals.checks,
      totals.guests,
      null,
      week.label,
    );
  });
}

function buildMonthSeries(input: ChartSeriesInput): RevenueDay[] {
  if (input.monthly.length > 0) {
    return input.monthly.map((m) =>
      toRevenueDay(
        m.month,
        m.revenue,
        m.checks,
        m.guests,
        m.plan,
        MONTHS_SHORT[m.month - 1] ?? String(m.month),
      ),
    );
  }

  const totals = sumDays(
    input.daily.filter((d) => d.day >= input.period.dayFrom && d.day <= input.period.dayTo),
  );
  return [
    toRevenueDay(
      input.period.month,
      totals.revenue,
      totals.checks,
      totals.guests,
      null,
      MONTHS_SHORT[input.period.month - 1] ?? String(input.period.month),
    ),
  ];
}

function buildQuarterSeries(input: ChartSeriesInput): RevenueDay[] {
  const months = input.monthly.length
    ? input.monthly
    : [{ month: input.period.month, revenue: sumDays(input.daily).revenue, checks: 0, guests: 0, plan: null }];

  const quarters = [
    { revenue: 0, checks: 0, guests: 0 },
    { revenue: 0, checks: 0, guests: 0 },
    { revenue: 0, checks: 0, guests: 0 },
    { revenue: 0, checks: 0, guests: 0 },
  ];

  for (const month of months) {
    const index = Math.floor((month.month - 1) / 3);
    quarters[index].revenue += month.revenue;
    quarters[index].checks += month.checks;
    quarters[index].guests += month.guests;
  }

  return quarters.map((q, index) =>
    toRevenueDay(index + 1, q.revenue, q.checks, q.guests, null, `Q${index + 1}`),
  );
}

/** Строит серию столбцов графика по режиму отображения. */
export function buildChartDisplaySeries(
  input: ChartSeriesInput,
  displayMode: ChartDisplayMode,
): RevenueDay[] {
  switch (displayMode) {
    case 'day':
      return buildDaySeries(input);
    case 'week':
      return buildWeekSeries(input);
    case 'month':
      return buildMonthSeries(input);
    case 'quarter':
      return buildQuarterSeries(input);
  }
}

export function chartDisplayTitle(displayMode: ChartDisplayMode): string {
  switch (displayMode) {
    case 'quarter':
      return 'Выручка по кварталам';
    case 'month':
      return 'Выручка по месяцам';
    case 'week':
      return 'Выручка по неделям';
    case 'day':
      return 'Выручка по дням';
  }
}

export function chartDisplayLegend(displayMode: ChartDisplayMode): string {
  switch (displayMode) {
    case 'quarter':
    case 'month':
      return 'клик по периоду — детали';
    case 'week':
      return 'клик по неделе — детали';
    case 'day':
      return 'клик по дню — детали';
  }
}
