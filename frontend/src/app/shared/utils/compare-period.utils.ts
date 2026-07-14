import type { ChartPeriodSelection, ChartWeekRange } from '../models/chart-period.model';
import type { PeriodGranularity } from '../models/common.model';
import type { ApiPeriod } from '../models/dashboard-api.model';
import type { WeekKpiContext } from '../models/dashboard-api.model';
import { resolveChartWeekRange, toIsoDateString } from './chart-period.utils';
import { formatIsoWeekRangeLabel, formatPeriodRange, inferPendingChartPeriod } from './period-format.utils';

function parseIsoDate(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function isFullMonth(period: ApiPeriod): boolean {
  return period.dayFrom === 1 && period.dayTo === daysInMonth(period.year, period.month);
}

export interface DataframePeriodContext {
  period: ApiPeriod;
  weekRange?: ChartWeekRange;
}

export function buildDataframePeriodContext(
  period: ApiPeriod,
  granularity: PeriodGranularity,
  chartSelection: ChartPeriodSelection | null,
): DataframePeriodContext {
  return {
    period,
    weekRange:
      granularity === 'week'
        ? resolveChartWeekRange(chartSelection, period)
        : undefined,
  };
}

export function formatDataframePeriodLabel(
  context: DataframePeriodContext,
  granularity: PeriodGranularity,
): string {
  if (granularity === 'week' && context.weekRange) {
    return formatIsoWeekRangeLabel(context.weekRange);
  }
  return formatPeriodRange(context.period);
}

export function isDataframeMonth(
  year: number,
  month: number,
  dataframe: ApiPeriod,
): boolean {
  return year === dataframe.year && month === dataframe.month;
}

export function isDataframeWeek(
  week: ChartWeekRange,
  dataframeWeek: ChartWeekRange | undefined,
): boolean {
  if (!dataframeWeek) return false;
  return (
    week.startDate === dataframeWeek.startDate &&
    week.endDate === dataframeWeek.endDate
  );
}

export function isCompareDraftSameAsDataframe(
  draftYear: number,
  draftMonth: number,
  draftWeekStart: string | null,
  draftWeekEnd: string | null,
  granularity: PeriodGranularity,
  dataframe: DataframePeriodContext,
): boolean {
  if (granularity === 'week') {
    if (!draftWeekStart || !draftWeekEnd || !dataframe.weekRange) return false;
    return isDataframeWeek(
      { startDate: draftWeekStart, endDate: draftWeekEnd },
      dataframe.weekRange,
    );
  }
  return isDataframeMonth(draftYear, draftMonth, dataframe.period);
}

export function isCompareSelectionSameAsDataframe(
  compare: ChartPeriodSelection,
  granularity: PeriodGranularity,
  dataframe: DataframePeriodContext,
): boolean {
  return isCompareDraftSameAsDataframe(
    compare.year,
    compare.month,
    compare.weekStartDate ?? null,
    compare.weekEndDate ?? null,
    granularity,
    dataframe,
  );
}

export function buildChartDataframeContext(
  chartSelection: ChartPeriodSelection | null,
  granularity: PeriodGranularity,
  dashboardPeriod: ApiPeriod,
): DataframePeriodContext {
  const period = chartSelection
    ? inferPendingChartPeriod(chartSelection, granularity, dashboardPeriod)
    : dashboardPeriod;
  return buildDataframePeriodContext(period, granularity, chartSelection);
}

/** Диапазон compare-периода для API из picker selection (зеркалит форму primary period). */
export function compareSelectionToDateRange(
  selection: ChartPeriodSelection,
  granularity: PeriodGranularity,
  primaryPeriod: ApiPeriod,
): { compareStart: string; compareEnd: string } {
  if (granularity === 'week') {
    if (!selection.weekStartDate || !selection.weekEndDate) {
      const monthDays = daysInMonth(selection.year, selection.month);
      if (isFullMonth(primaryPeriod)) {
        return {
          compareStart: toIsoDateString(selection.year, selection.month, 1),
          compareEnd: toIsoDateString(selection.year, selection.month, monthDays),
        };
      }
      const dayTo = Math.min(primaryPeriod.dayTo, monthDays);
      const dayFrom = Math.min(primaryPeriod.dayFrom, monthDays);
      return {
        compareStart: toIsoDateString(selection.year, selection.month, dayFrom),
        compareEnd: toIsoDateString(selection.year, selection.month, dayTo),
      };
    }
    return {
      compareStart: selection.weekStartDate,
      compareEnd: selection.weekEndDate,
    };
  }

  if (granularity === 'year') {
    const endMonth = primaryPeriod.month;
    const endDay = Math.min(primaryPeriod.dayTo, daysInMonth(selection.year, endMonth));
    return {
      compareStart: toIsoDateString(selection.year, 1, 1),
      compareEnd: toIsoDateString(selection.year, endMonth, endDay),
    };
  }

  const monthDays = daysInMonth(selection.year, selection.month);
  if (isFullMonth(primaryPeriod)) {
    return {
      compareStart: toIsoDateString(selection.year, selection.month, 1),
      compareEnd: toIsoDateString(selection.year, selection.month, monthDays),
    };
  }

  const dayTo = Math.min(primaryPeriod.dayTo, monthDays);
  const dayFrom = Math.min(primaryPeriod.dayFrom, monthDays);
  return {
    compareStart: toIsoDateString(selection.year, selection.month, dayFrom),
    compareEnd: toIsoDateString(selection.year, selection.month, dayTo),
  };
}

/** Active period для compare picker (week — из weekKpi prev range). */
export function resolveCompareActivePeriod(
  compare: ApiPeriod,
  granularity: PeriodGranularity,
  weekKpi: WeekKpiContext | null | undefined,
): { year: number; month: number; dayFrom: number; dayTo: number } {
  if (granularity === 'week' && weekKpi?.prevWeekStart && weekKpi.prevWeekEnd) {
    const start = parseIsoDate(weekKpi.prevWeekStart);
    const end = parseIsoDate(weekKpi.prevWeekEnd);
    return {
      year: start.year,
      month: start.month,
      dayFrom: start.day,
      dayTo: end.month === start.month ? end.day : start.day,
    };
  }
  return compare;
}

/** ApiPeriod для подписи compare pill из picker selection. */
export function compareSelectionToApiPeriod(
  selection: ChartPeriodSelection,
  granularity: PeriodGranularity,
  primaryPeriod: ApiPeriod,
): ApiPeriod {
  if (granularity === 'week' && selection.weekStartDate && selection.weekEndDate) {
    const start = parseIsoDate(selection.weekStartDate);
    const end = parseIsoDate(selection.weekEndDate);
    return {
      year: start.year,
      month: start.month,
      dayFrom: start.day,
      dayTo: end.month === start.month ? end.day : start.day,
    };
  }

  if (granularity === 'year') {
    const endMonth = primaryPeriod.month;
    const endDay = Math.min(primaryPeriod.dayTo, daysInMonth(selection.year, endMonth));
    return {
      year: selection.year,
      month: endMonth,
      dayFrom: 1,
      dayTo: endDay,
    };
  }

  const monthDays = daysInMonth(selection.year, selection.month);
  if (isFullMonth(primaryPeriod)) {
    return {
      year: selection.year,
      month: selection.month,
      dayFrom: 1,
      dayTo: monthDays,
    };
  }

  return {
    year: selection.year,
    month: selection.month,
    dayFrom: Math.min(primaryPeriod.dayFrom, monthDays),
    dayTo: Math.min(primaryPeriod.dayTo, monthDays),
  };
}

/** ApiPeriod → selection для draft picker (month / week). */
export function apiPeriodToCompareSelection(
  compare: ApiPeriod,
  granularity: PeriodGranularity,
): ChartPeriodSelection {
  if (granularity === 'week') {
    const start = toIsoDateString(compare.year, compare.month, compare.dayFrom);
    const end = toIsoDateString(compare.year, compare.month, compare.dayTo);
    return {
      year: compare.year,
      month: compare.month,
      weekStartDate: start,
      weekEndDate: end,
    };
  }
  return { year: compare.year, month: compare.month };
}
