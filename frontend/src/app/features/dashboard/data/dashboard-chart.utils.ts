import type { ChartPeriodSelection } from '../../../shared/models/chart-period.model';
import type { ChartWeekRange } from '../../../shared/models/chart-period.model';
import {
  buildDashboardCacheKey,
  chartSelectionToQuery,
} from '../../../core/data/analytics-cache-key';
import type { PeriodGranularity } from '../../../shared/models/common.model';
import type { DashboardV2, PeriodV2, RevenueDayV2, RevenueMonthV2 } from '../../../shared/models/dashboard-v2.model';
import { resolveDefaultWeekRange } from '../../../shared/utils/chart-period.utils';
import { buildWeekRevenueDays } from '../../../shared/utils/period-format.utils';

export type DashboardChartSlice = Pick<
  DashboardV2,
  'period' | 'compare' | 'kpis' | 'revenueByDay' | 'revenueByMonth' | 'dataBounds'
>;

const EMPTY_KPI_COMPARISON = {
  prevValue: null as number | null,
  forecast: null as number | null,
};

/** Placeholder KPI while the selected chart slice is loading. */
export function emptyChartKpis(): DashboardV2['kpis'] {
  const empty = { value: 0, ...EMPTY_KPI_COMPARISON };
  return {
    revenue: { ...empty },
    checks: { ...empty },
    guests: { ...empty },
    avgCheck: { ...empty },
  };
}

/** Эффективный chartPeriod для cache/API: в year-mode null → текущий год base. */
export function resolveEffectiveChartSelection(
  selection: ChartPeriodSelection | null,
  granularity: PeriodGranularity,
  basePeriod: PeriodV2,
): ChartPeriodSelection {
  if (granularity === 'year') {
    return { year: selection?.year ?? basePeriod.year, month: 1 };
  }
  return selection ?? { year: basePeriod.year, month: basePeriod.month };
}

export function dashboardChartCacheKey(
  tenantScope: string,
  selection: ChartPeriodSelection,
  granularity: PeriodGranularity,
): string {
  return buildDashboardCacheKey(tenantScope, chartSelectionToQuery(selection, granularity));
}

export function chartFetchNeeded(
  selection: ChartPeriodSelection | null,
  granularity: PeriodGranularity,
  basePeriod: PeriodV2 | null,
): boolean {
  if (!basePeriod) return false;
  /** /latest — KPI только за текущий месяц; year-mode всегда нужен y:YYYY. */
  if (granularity === 'year') return true;
  if (!selection) return false;
  return selection.year !== basePeriod.year || selection.month !== basePeriod.month;
}

/** Slice matches the picker selection for the active granularity. */
export function chartSliceMatchesSelection(
  slice: DashboardChartSlice,
  selection: ChartPeriodSelection,
  granularity: PeriodGranularity,
): boolean {
  const { period } = slice;
  if (granularity === 'year') {
    return period.year === selection.year;
  }
  return period.year === selection.year && period.month === selection.month;
}

/** Slice for the current picker selection is present in cache (or interim YTD is usable). */
export function isChartSliceReady(
  base: DashboardV2,
  selection: ChartPeriodSelection,
  granularity: PeriodGranularity,
  slice: DashboardChartSlice | null,
  cacheKey: string | null,
): boolean {
  if (!chartFetchNeeded(selection, granularity, base.period)) {
    return true;
  }
  if (slice && cacheKey && chartSliceMatchesSelection(slice, selection, granularity)) {
    return true;
  }
  if (
    granularity === 'year' &&
    selection.year === base.period.year &&
    (base.revenueByMonth?.length ?? 0) > 0
  ) {
    return true;
  }
  return false;
}

/** Merge base KPI payload with a chart slice only when it belongs to the current cache key. */
export function resolveMergedChartData(
  base: DashboardV2,
  selection: ChartPeriodSelection,
  granularity: PeriodGranularity,
  slice: DashboardChartSlice | null,
  cacheKey: string | null,
): DashboardV2 {
  if (!chartFetchNeeded(selection, granularity, base.period)) {
    return base;
  }
  if (slice && cacheKey && chartSliceMatchesSelection(slice, selection, granularity)) {
    return mergeDashboardChartData(base, slice);
  }

  const interim = {
    ...base,
    revenueByDay: [] as DashboardV2['revenueByDay'],
    revenueByMonth: [] as DashboardV2['revenueByMonth'],
  };

  if (granularity === 'year' && selection.year === base.period.year) {
    /** /latest уже содержит YTD revenueByMonth — KPI пересчитаются в store, пока грузится y:YYYY. */
    return { ...interim, revenueByMonth: base.revenueByMonth ?? [] };
  }

  /** Не показываем KPI текущего месяца из /latest, пока не пришёл slice выбранного периода. */
  return { ...interim, kpis: emptyChartKpis() };
}

export function mergeDashboardChartData(
  base: DashboardV2,
  chart: DashboardChartSlice,
): DashboardV2 {
  return {
    ...base,
    period: chart.period,
    compare: chart.compare,
    kpis: chart.kpis,
    revenueByDay: chart.revenueByDay,
    revenueByMonth: chart.revenueByMonth,
    dataBounds: chart.dataBounds,
  };
}

/** KPI YTD из помесячной серии (interim, пока не загружен y:YYYY). */
export function aggregateKpisFromRevenueMonths(
  months: RevenueMonthV2[],
): DashboardV2['kpis'] {
  const revenue = months.reduce((sum, month) => sum + month.revenue, 0);
  const checks = months.reduce((sum, month) => sum + month.checks, 0);
  const guests = months.reduce((sum, month) => sum + month.guests, 0);
  const emptyComparison = { prevValue: null as number | null, forecast: null as number | null };

  return {
    revenue: { value: revenue, ...emptyComparison },
    checks: { value: checks, ...emptyComparison },
    guests: { value: guests, ...emptyComparison },
    avgCheck: {
      value: checks ? Math.round(revenue / checks) : 0,
      ...emptyComparison,
    },
  };
}

/** Пересчитывает KPI карточек для year-timeframe из revenueByMonth. */
export function applyYearTimeframeKpis(data: DashboardV2): DashboardV2 {
  const months = data.revenueByMonth ?? [];
  if (!months.length) return data;

  return {
    ...data,
    kpis: aggregateKpisFromRevenueMonths(months),
  };
}

/** KPI по дням (недельный датафрейм внутри месяца). */
export function aggregateKpisFromRevenueDays(days: RevenueDayV2[]): DashboardV2['kpis'] {
  const revenue = days.reduce((sum, day) => sum + day.revenue, 0);
  const checks = days.reduce((sum, day) => sum + day.checks, 0);
  const guests = days.reduce((sum, day) => sum + day.guests, 0);
  const emptyComparison = { prevValue: null as number | null, forecast: null as number | null };

  return {
    revenue: { value: revenue, ...emptyComparison },
    checks: { value: checks, ...emptyComparison },
    guests: { value: guests, ...emptyComparison },
    avgCheck: {
      value: checks ? Math.round(revenue / checks) : 0,
      ...emptyComparison,
    },
  };
}

/** Пересчитывает KPI карточек для выбранной календарной недели. */
export function applyWeekTimeframeKpis(
  data: DashboardV2,
  weekRange?: ChartWeekRange,
  lookupDay?: (year: number, month: number, day: number) => RevenueDayV2 | undefined,
): DashboardV2 {
  const period = data.period;
  const effectiveRange =
    weekRange ?? resolveDefaultWeekRange(period.year, period.month, period.dayFrom, period.dayTo);
  const weekDays = buildWeekRevenueDays(
    data.revenueByDay,
    period,
    effectiveRange,
    lookupDay,
  );

  return {
    ...data,
    period: {
      ...period,
      dayFrom: weekDays[0]?.day ?? period.dayFrom,
      dayTo: weekDays[weekDays.length - 1]?.day ?? period.dayTo,
    },
    kpis: aggregateKpisFromRevenueDays(weekDays),
  };
}

export function pickDashboardChartSlice(data: DashboardV2): DashboardChartSlice {
  return {
    period: data.period,
    compare: data.compare,
    kpis: data.kpis,
    revenueByDay: data.revenueByDay,
    revenueByMonth: data.revenueByMonth,
    dataBounds: data.dataBounds,
  };
}
