import type { ChartDisplayMode, PeriodGranularity } from '../models/common.model';
import type { ChartWeekRange } from '../models/chart-period.model';
import type { ApiPeriod, RevenueDayFact, RevenueMonthFact } from '../models/dashboard-api.model';
import type { RevenueDay } from '../models/dashboard.model';
import {
  daysInMonth,
  enumerateIsoDateRange,
  listWeekRangesInMonth,
} from './chart-period.utils';
import { MONTHS_SHORT } from '../constants/month-labels.constants';
import { buildWeekRevenueDays, formatIsoWeekRangeLabel } from './period-format.utils';
import { barMarkValue } from './revenue-days-chart.utils';

export interface ChartSeriesInput {
  daily: RevenueDayFact[];
  monthly: RevenueMonthFact[];
  period: ApiPeriod;
  timeframe: PeriodGranularity;
  weekRange?: ChartWeekRange;
  weekDayLookup?: (year: number, month: number, day: number) => RevenueDayFact | undefined;
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
  forecast: number | null,
  barLabel?: string,
  weekday = 1,
): RevenueDay {
  return {
    day,
    weekday,
    revenue,
    plan,
    forecast,
    checks,
    guests,
    avg: checks ? revenue / checks : 0,
    barLabel,
  };
}

function sumDays(days: RevenueDayFact[]): {
  revenue: number;
  checks: number;
  guests: number;
  forecast: number | null;
} {
  let forecastSum = 0;
  let hasForecast = false;
  for (const day of days) {
    if (day.forecast !== null && day.forecast > 0) {
      forecastSum += day.forecast;
      hasForecast = true;
    }
  }
  return {
    ...days.reduce(
      (acc, day) => ({
        revenue: acc.revenue + day.revenue,
        checks: acc.checks + day.checks,
        guests: acc.guests + day.guests,
      }),
      { revenue: 0, checks: 0, guests: 0 },
    ),
    forecast: hasForecast ? forecastSum : null,
  };
}

function sumMonths(months: RevenueMonthFact[]): {
  revenue: number;
  checks: number;
  guests: number;
  forecast: number | null;
} {
  let forecastSum = 0;
  let hasForecast = false;
  for (const month of months) {
    if (month.forecast !== null && month.forecast > 0) {
      forecastSum += month.forecast;
      hasForecast = true;
    }
  }
  return {
    ...months.reduce(
      (acc, month) => ({
        revenue: acc.revenue + month.revenue,
        checks: acc.checks + month.checks,
        guests: acc.guests + month.guests,
      }),
      { revenue: 0, checks: 0, guests: 0 },
    ),
    forecast: hasForecast ? forecastSum : null,
  };
}

function calendarWeekday(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay();
}

function emptyMonthFact(month: number): RevenueMonthFact {
  return { month, revenue: 0, checks: 0, guests: 0, plan: null, forecast: null };
}

/** Полный календарный год: месяцы без данных — нулевые столбцы. */
function yearMonthlyFacts(monthly: RevenueMonthFact[]): RevenueMonthFact[] {
  const byMonth = new Map(monthly.map((m) => [m.month, m]));
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    return byMonth.get(month) ?? emptyMonthFact(month);
  });
}

function buildDaySeries(input: ChartSeriesInput): RevenueDay[] {
  const weekRange = input.weekRange;

  if (input.timeframe === 'week') {
    return buildWeekRevenueDays(
      input.daily,
      input.period,
      weekRange,
      input.weekDayLookup,
    ).map((d) =>
      toRevenueDay(
        d.day,
        d.revenue,
        d.checks,
        d.guests,
        d.plan,
        d.forecast ?? null,
        undefined,
        d.weekday,
      ),
    );
  }

  if (input.timeframe === 'month') {
    const { year, month } = input.period;
    const totalDays = daysInMonth(year, month);
    const byDay = new Map(input.daily.map((d) => [d.day, d]));

    return Array.from({ length: totalDays }, (_, index) => {
      const dayNum = index + 1;
      const entry = byDay.get(dayNum);
      if (entry) {
        return toRevenueDay(
          entry.day,
          entry.revenue,
          entry.checks,
          entry.guests,
          entry.plan,
          entry.forecast,
          undefined,
          entry.weekday,
        );
      }
      return toRevenueDay(
        dayNum,
        0,
        0,
        0,
        null,
        null,
        undefined,
        calendarWeekday(year, month, dayNum),
      );
    });
  }

  return input.daily
    .filter((d) => d.day >= input.period.dayFrom && d.day <= input.period.dayTo)
    .map((d) =>
      toRevenueDay(
        d.day,
        d.revenue,
        d.checks,
        d.guests,
        d.plan,
        d.forecast,
        undefined,
        d.weekday,
      ),
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
    return [
      toRevenueDay(
        1,
        totals.revenue,
        totals.checks,
        totals.guests,
        null,
        totals.forecast,
        label,
      ),
    ];
  }

  const weeks = listWeekRangesInMonth(input.period.year, input.period.month, null);
  const byDay = new Map(input.daily.map((d) => [d.day, d]));

  return weeks.map((week, index) => {
    const slice: RevenueDayFact[] = [];
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
      totals.forecast,
      week.label,
    );
  });
}

function buildMonthSeries(input: ChartSeriesInput): RevenueDay[] {
  if (input.timeframe === 'year') {
    return yearMonthlyFacts(input.monthly).map((m) =>
      toRevenueDay(
        m.month,
        m.revenue,
        m.checks,
        m.guests,
        m.plan,
        m.forecast,
        MONTHS_SHORT[m.month - 1] ?? String(m.month),
      ),
    );
  }

  if (input.monthly.length > 0) {
    return input.monthly.map((m) =>
      toRevenueDay(
        m.month,
        m.revenue,
        m.checks,
        m.guests,
        m.plan,
        m.forecast,
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
      totals.forecast,
      MONTHS_SHORT[input.period.month - 1] ?? String(input.period.month),
    ),
  ];
}

function buildQuarterSeries(input: ChartSeriesInput): RevenueDay[] {
  const months =
    input.timeframe === 'year'
      ? yearMonthlyFacts(input.monthly)
      : input.monthly.length
        ? input.monthly
        : [
            {
              month: input.period.month,
              revenue: sumDays(input.daily).revenue,
              checks: 0,
              guests: 0,
              plan: null,
              forecast: null,
            },
          ];

  const quarters = [
    { revenue: 0, checks: 0, guests: 0, months: [] as RevenueMonthFact[] },
    { revenue: 0, checks: 0, guests: 0, months: [] as RevenueMonthFact[] },
    { revenue: 0, checks: 0, guests: 0, months: [] as RevenueMonthFact[] },
    { revenue: 0, checks: 0, guests: 0, months: [] as RevenueMonthFact[] },
  ];

  for (const month of months) {
    const index = Math.floor((month.month - 1) / 3);
    quarters[index].revenue += month.revenue;
    quarters[index].checks += month.checks;
    quarters[index].guests += month.guests;
    quarters[index].months.push(month);
  }

  return quarters.map((q, index) => {
    const forecast = sumMonths(q.months).forecast;
    return toRevenueDay(
      index + 1,
      q.revenue,
      q.checks,
      q.guests,
      null,
      forecast,
      `Q${index + 1}`,
    );
  });
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

/** Максимум шкалы графика с учётом факта и засечек прогноза. */
export function chartSeriesMaxValue(days: RevenueDay[]): number {
  return days.reduce((max, d) => Math.max(max, d.revenue, barMarkValue(d) ?? 0), 1);
}
