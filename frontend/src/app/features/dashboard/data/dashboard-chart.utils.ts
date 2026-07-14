import type { ChartPeriodSelection } from '../../../shared/models/chart-period.model';
import {
  buildDashboardCacheKey,
  chartSelectionToQuery,
} from '../../../core/data/analytics-cache-key';
import type { PeriodGranularity } from '../../../shared/models/common.model';
import type {
  DashboardApi,
  ApiPeriod,
  DataBounds,
  RevenueDayFact,
  RevenueMonthFact,
  DashboardCompareSlice,
} from '../../../shared/models/dashboard-api.model';
import {
  inferComparePeriod,
  inferPendingChartPeriod,
} from '../../../shared/utils/period-format.utils';
import {
  resolveDefaultWeekForMonth,
  resolveLatestChartPeriodSelection,
} from '../../../shared/utils/chart-period.utils';

export type { DashboardCompareSlice } from '../../../shared/models/dashboard-api.model';

export type DashboardChartSlice = Pick<
  DashboardApi,
  | 'period'
  | 'compare'
  | 'kpis'
  | 'revenueByDay'
  | 'revenueByMonth'
  | 'dataBounds'
  | 'weekKpi'
>;

const EMPTY_KPI_COMPARISON = {
  prevValue: null as number | null,
  forecast: null as number | null,
};

/** Placeholder KPI while the selected chart slice is loading. */
export function emptyChartKpis(): DashboardApi['kpis'] {
  const empty = { value: 0, ...EMPTY_KPI_COMPARISON };
  return {
    revenue: { ...empty },
    checks: { ...empty },
    guests: { ...empty },
    avgCheck: { ...empty },
  };
}

/** Эффективный chartPeriod для cache/API; в week-mode всегда с ISO-диапазоном недели. */
export function resolveEffectiveChartSelection(
  selection: ChartPeriodSelection | null,
  granularity: PeriodGranularity,
  basePeriod: ApiPeriod,
  bounds: DataBounds | null = null,
): ChartPeriodSelection {
  if (granularity === 'year') {
    return { year: selection?.year ?? basePeriod.year, month: 1 };
  }
  if (granularity === 'week') {
    if (selection?.weekStartDate && selection?.weekEndDate) {
      return selection;
    }
    const latest = resolveLatestChartPeriodSelection('week', bounds, basePeriod);
    if (latest?.weekStartDate && latest?.weekEndDate) {
      return latest;
    }
    const year = selection?.year ?? basePeriod.year;
    const month = selection?.month ?? basePeriod.month;
    const week = resolveDefaultWeekForMonth(year, month, bounds, basePeriod);
    return {
      year,
      month,
      weekStartDate: week.startDate,
      weekEndDate: week.endDate,
    };
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
  selection: ChartPeriodSelection,
  granularity: PeriodGranularity,
  basePeriod: ApiPeriod | null,
): boolean {
  if (!basePeriod) return false;
  /** Week-mode всегда требует overlay с weekStart/weekEnd, даже для «текущей» недели. */
  if (granularity === 'week') return true;
  /** /latest — KPI только за текущий месяц; year-mode всегда нужен y:YYYY. */
  if (granularity === 'year') return true;
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
  if (granularity === 'week') {
    if (!selection.weekStartDate || !selection.weekEndDate) return false;
    const week = slice.weekKpi;
    if (!week) return false;
    return (
      period.year === selection.year &&
      period.month === selection.month &&
      week.weekStart === selection.weekStartDate &&
      week.weekEnd === selection.weekEndDate
    );
  }
  if (granularity === 'month') {
    if (slice.weekKpi) return false;
    return period.year === selection.year && period.month === selection.month;
  }
  return false;
}

/** Slice for the current picker selection is present in cache (or interim YTD is usable). */
export function isChartSliceReady(
  base: DashboardApi,
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
  base: DashboardApi,
  selection: ChartPeriodSelection,
  granularity: PeriodGranularity,
  slice: DashboardChartSlice | null,
  cacheKey: string | null,
): DashboardApi {
  if (!chartFetchNeeded(selection, granularity, base.period)) {
    return base;
  }
  if (slice && cacheKey && chartSliceMatchesSelection(slice, selection, granularity)) {
    return mergeDashboardChartData(base, slice);
  }

  const interim = {
    ...base,
    revenueByDay: [] as DashboardApi['revenueByDay'],
    revenueByMonth: [] as DashboardApi['revenueByMonth'],
  };

  if (granularity === 'year' && selection.year === base.period.year) {
    /** /latest уже содержит YTD revenueByMonth — KPI пересчитаются в store, пока грузится y:YYYY. */
    return { ...interim, revenueByMonth: base.revenueByMonth ?? [] };
  }

  const pendingPeriod = inferPendingChartPeriod(selection, granularity, base.period);

  /** Не показываем KPI /latest или month-slice, пока не пришёл нужный chart slice. */
  return {
    ...interim,
    period: pendingPeriod,
    kpis: emptyChartKpis(),
    weekKpi: null,
    compare: inferComparePeriod(pendingPeriod),
  };
}

export function mergeDashboardChartData(
  base: DashboardApi,
  chart: DashboardChartSlice,
): DashboardApi {
  return {
    ...base,
    period: chart.period,
    compare: chart.compare,
    kpis: chart.kpis,
    revenueByDay: chart.revenueByDay,
    revenueByMonth: chart.revenueByMonth,
    dataBounds: chart.dataBounds,
    weekKpi: chart.weekKpi ?? null,
  };
}

/** KPI + compare из ответа с compareStart/compareEnd (без перезагрузки графика). */
export function pickDashboardCompareSlice(
  data: Pick<DashboardApi, 'kpis' | 'compare' | 'weekKpi'>,
): DashboardCompareSlice {
  return {
    kpis: data.kpis,
    compare: data.compare,
    weekKpi: data.weekKpi ?? null,
  };
}

export function mergeCompareOverlay(
  chart: DashboardApi,
  overlay: DashboardCompareSlice,
): DashboardApi {
  return {
    ...chart,
    kpis: overlay.kpis,
    compare: overlay.compare,
    weekKpi: overlay.weekKpi ?? null,
  };
}

export function isCompareOverlayReady(compareKey: string | null, cached: boolean): boolean {
  if (!compareKey) return true;
  return cached;
}

/** KPI YTD из помесячной серии (interim, пока не загружен y:YYYY). */
export function aggregateKpisFromRevenueMonths(
  months: RevenueMonthFact[],
): DashboardApi['kpis'] {
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
export function applyYearTimeframeKpis(data: DashboardApi): DashboardApi {
  const months = data.revenueByMonth ?? [];
  if (!months.length) return data;

  return {
    ...data,
    kpis: aggregateKpisFromRevenueMonths(months),
  };
}

/** KPI по дням (недельный датафрейм внутри месяца). */
export function aggregateKpisFromRevenueDays(days: RevenueDayFact[]): DashboardApi['kpis'] {
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

export function pickDashboardChartSlice(data: DashboardApi): DashboardChartSlice {
  return {
    period: data.period,
    compare: data.compare,
    kpis: data.kpis,
    revenueByDay: data.revenueByDay,
    revenueByMonth: data.revenueByMonth,
    dataBounds: data.dataBounds,
    weekKpi: data.weekKpi ?? null,
  };
}
