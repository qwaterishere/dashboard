/**
 * Сборка DashboardApi из одного /api/base-metrics/snapshot (+ опционально /api/targets).
 */

import { catchError, forkJoin, map, of, switchMap, type Observable } from 'rxjs';

import type { DashboardQueryKey } from './analytics-cache-key';
import type { BaseMetricsRepository } from './base-metrics.repository';
import type { TargetsRepository } from './targets.repository';
import type {
  DashboardApi,
  DashboardKpis,
  KpiMetric,
  RevenueDayFact,
  RevenueMonthFact,
  UnitSums,
  WeekDayStat,
  WeekKpiContext,
} from '../../shared/models/dashboard-api.model';
import type { DashboardChartApi } from '../../shared/models/dashboard-chart-api.model';
import type { DashboardKpiApi } from '../../shared/models/dashboard-kpi-api.model';
import type {
  MetricBatchApi,
  MetricBatchItemApi,
  MetricBoundsApi,
  MetricForecastApi,
  MetricSeriesApi,
  MetricSnapshotApi,
  SnapshotMode,
  UnitsResponseApi,
} from '../../shared/models/base-metrics-api.model';
import type { TargetsData } from '../../shared/models/targets.model';
import { buildMonthDayPlans } from '../../features/targets/data/targets-revenue-plan.utils';
import {
  daysInMonth,
  formatIsoDate,
  isoToApiPeriod,
  parseIsoDate,
  weekdayJs,
} from '../../shared/utils/iso-date.utils';

export interface DashboardAssembleDeps {
  metrics: BaseMetricsRepository;
  targets: TargetsRepository;
}

export interface ResolvedDashboardPeriod {
  dateFrom: string;
  dateTo: string;
  earliest: string | null;
  latest: string | null;
  yearMode: boolean;
  queryYear: number | null;
  queryMonth: number | null;
}

function emptyKpi(): KpiMetric {
  return { value: 0, prevValue: null, forecast: null, forecastToday: null };
}

function emptyKpis(): DashboardKpis {
  return {
    revenue: emptyKpi(),
    checks: emptyKpi(),
    guests: emptyKpi(),
    avgCheck: emptyKpi(),
  };
}

function num(value: number | null | undefined): number {
  return value == null ? 0 : value;
}

function avgValue(revenue: number, checks: number): number {
  return checks > 0 ? revenue / checks : 0;
}

function batchByMetric(batch: MetricBatchApi): Map<string, MetricBatchItemApi> {
  return new Map(batch.items.map((item) => [item.metric, item]));
}

function seriesByMetric(series: MetricSeriesApi[]): Map<string, MetricSeriesApi> {
  return new Map(series.map((item) => [item.metric, item]));
}

export function resolveDashboardPeriod(
  query: DashboardQueryKey,
  bounds: MetricBoundsApi,
  defaultRange: { date_from: string; date_to: string } | null,
): ResolvedDashboardPeriod {
  const earliest = bounds.date_from;
  const latest = bounds.date_to;

  if (latest == null) {
    const today = formatIsoDate(new Date());
    return {
      dateFrom: `${today.slice(0, 8)}01`,
      dateTo: today,
      earliest,
      latest,
      yearMode: false,
      queryYear: query.year ?? null,
      queryMonth: query.month ?? null,
    };
  }

  if (query.year == null && query.month == null) {
    const range = defaultRange ?? {
      date_from: `${latest.slice(0, 8)}01`,
      date_to: latest,
    };
    return {
      dateFrom: range.date_from,
      dateTo: range.date_to,
      earliest,
      latest,
      yearMode: false,
      queryYear: null,
      queryMonth: null,
    };
  }

  if (query.year != null && query.month == null) {
    const yearStart = `${query.year}-01-01`;
    const yearEnd = `${query.year}-12-31`;
    if (earliest == null || earliest > yearEnd || latest < yearStart) {
      throw new Error(`No data for year ${query.year}`);
    }
    const clipped = latest > yearEnd ? yearEnd : latest < yearStart ? yearStart : latest;
    return {
      dateFrom: yearStart,
      dateTo: clipped,
      earliest,
      latest,
      yearMode: true,
      queryYear: query.year,
      queryMonth: null,
    };
  }

  if (query.year == null || query.month == null) {
    throw new Error('Both year and month are required');
  }

  const latestDate = parseIsoDate(latest);
  if (
    query.year > latestDate.getFullYear() ||
    (query.year === latestDate.getFullYear() && query.month > latestDate.getMonth() + 1)
  ) {
    throw new Error('Period is in the future');
  }

  const dateFrom = `${query.year}-${String(query.month).padStart(2, '0')}-01`;
  const lastDay = daysInMonth(query.year, query.month);
  const monthEnd = `${query.year}-${String(query.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const dateTo =
    query.year === latestDate.getFullYear() && query.month === latestDate.getMonth() + 1
      ? latest
      : monthEnd;

  return {
    dateFrom,
    dateTo,
    earliest,
    latest,
    yearMode: false,
    queryYear: query.year,
    queryMonth: query.month,
  };
}

function mapUnits(units: UnitsResponseApi): UnitSums[] {
  return units.units.map((unit) => ({
    key: unit.key,
    revenue: unit.revenue,
    cost: unit.cost,
    prevRevenue: unit.prev_revenue ?? 0,
    prevCost: unit.prev_cost ?? 0,
  }));
}

function buildDayPlans(
  targets: TargetsData | null,
  dateFrom: string,
  dateTo: string,
): Map<string, number> {
  const plans = new Map<string, number>();
  if (!targets || targets.revenue.monthPlan <= 0) return plans;
  const year = targets.period.year;
  const month = targets.period.month;
  const dayPlans = buildMonthDayPlans(
    year,
    month,
    targets.revenue.monthPlan,
    targets.revenue.weekProfile,
    Object.fromEntries(
      Object.entries(targets.dailyOverrides).map(([day, amount]) => [Number(day), amount]),
    ),
  );
  for (const plan of dayPlans) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(plan.day).padStart(2, '0')}`;
    if (iso >= dateFrom && iso <= dateTo) plans.set(iso, plan.amount);
  }
  return plans;
}

function buildRevenueByDay(
  revenue: MetricSeriesApi | undefined,
  checks: MetricSeriesApi | undefined,
  guests: MetricSeriesApi | undefined,
  forecast: MetricForecastApi | undefined,
  dayPlans: Map<string, number>,
): RevenueDayFact[] {
  if (!revenue) return [];
  const forecastByDate = new Map(
    (forecast?.ready ? forecast.points : []).map((point) => [point.date, point.value]),
  );
  return revenue.points.map((point, index) => {
    const rev = num(point.value);
    const chk = num(checks?.points[index]?.value);
    const gst = num(guests?.points[index]?.value);
    const expected = forecastByDate.get(point.date);
    return {
      day: parseIsoDate(point.date).getDate(),
      weekday: weekdayJs(point.date),
      revenue: rev,
      checks: chk,
      guests: gst,
      plan: dayPlans.get(point.date) ?? null,
      forecast: expected != null && expected > 0 ? expected : null,
    };
  });
}

function buildRevenueByMonth(
  revenue: MetricSeriesApi | undefined,
  checks: MetricSeriesApi | undefined,
  guests: MetricSeriesApi | undefined,
  monthPlans: Map<number, number>,
  forecast: MetricForecastApi | undefined,
): RevenueMonthFact[] {
  if (!revenue) return [];
  const forecastByMonth = new Map<number, number>();
  if (forecast?.ready) {
    for (const point of forecast.points) {
      const month = parseIsoDate(point.date).getMonth() + 1;
      forecastByMonth.set(month, (forecastByMonth.get(month) ?? 0) + num(point.value));
    }
  }
  const months: RevenueMonthFact[] = revenue.points.map((point, index) => {
    const month = parseIsoDate(point.date).getMonth() + 1;
    const fc = forecastByMonth.get(month);
    return {
      month,
      revenue: num(point.value),
      checks: num(checks?.points[index]?.value),
      guests: num(guests?.points[index]?.value),
      plan: monthPlans.get(month) ?? null,
      forecast: fc != null && fc > 0 ? fc : null,
    };
  });
  while (months.length > 1 && months[0]!.revenue === 0 && months[0]!.checks === 0) {
    months.shift();
  }
  return months;
}

function buildKpis(
  batch: MetricBatchApi,
  forecasts: MetricForecastApi[],
): DashboardKpis {
  const byMetric = batchByMetric(batch);
  const byFc = new Map(forecasts.map((item) => [item.metric, item]));
  const revFc = byFc.get('revenue');
  const chkFc = byFc.get('checks');
  const gstFc = byFc.get('guests');

  const metric = (
    item: MetricBatchItemApi | undefined,
    forecast: MetricForecastApi | undefined,
  ): KpiMetric => ({
    value: num(item?.value),
    prevValue: item?.base_value == null ? null : item.base_value,
    forecast: forecast?.ready ? forecast.forecast : null,
    forecastToday: forecast?.ready ? forecast.forecast_today : null,
  });

  const revenue = byMetric.get('revenue');
  const checks = byMetric.get('checks');
  const avg = byMetric.get('avg-check');
  const revForecast = revFc?.ready ? revFc.forecast : null;
  const chkForecast = chkFc?.ready ? chkFc.forecast : null;
  const revPace = revFc?.ready ? revFc.forecast_today : null;
  const chkPace = chkFc?.ready ? chkFc.forecast_today : null;

  return {
    revenue: metric(revenue, revFc),
    checks: metric(checks, chkFc),
    guests: metric(byMetric.get('guests'), gstFc),
    avgCheck: {
      value: avg?.value == null ? avgValue(num(revenue?.value), num(checks?.value)) : avg.value,
      prevValue: avg?.base_value == null ? null : avg.base_value,
      forecast:
        revForecast != null && chkForecast != null && chkForecast > 0
          ? revForecast / chkForecast
          : null,
      forecastToday:
        revPace != null && chkPace != null && chkPace > 0 ? revPace / chkPace : null,
    },
  };
}

function buildWeekKpi(
  snap: MetricSnapshotApi,
): WeekKpiContext | null {
  if (!snap.week_start || !snap.week_end || !snap.week_batch) return null;
  const byMetric = batchByMetric(snap.week_batch);
  const revenue = num(byMetric.get('revenue')?.value);
  const checks = num(byMetric.get('checks')?.value);
  const guests = num(byMetric.get('guests')?.value);
  const series = seriesByMetric(snap.week_day_series);
  const revSeries = series.get('revenue');
  const chkSeries = series.get('checks');
  const gstSeries = series.get('guests');
  if (!revSeries) return null;

  const dayStats: WeekDayStat[] = revSeries.points.map((point, index) => {
    const rev = num(point.value);
    const chk = num(chkSeries?.points[index]?.value);
    const gst = num(gstSeries?.points[index]?.value);
    return {
      date: point.date,
      weekday: weekdayJs(point.date),
      revenue: rev,
      checks: chk,
      guests: gst,
      avgCheck: avgValue(rev, chk),
    };
  });

  const active = dayStats.filter((day) => day.checks > 0 || day.revenue > 0);
  const peakDay = active.length
    ? active.reduce((best, day) => (day.revenue > best.revenue ? day : best))
    : null;
  const weakDay = active.length
    ? active.reduce((worst, day) => (day.revenue < worst.revenue ? day : worst))
    : null;
  const avgChecks = dayStats.filter((day) => day.checks > 0).map((day) => day.avgCheck);
  const daysInWeek = dayStats.length || 7;
  const monthRevenue = snap.month_revenue ?? 0;

  const compareFrom =
    snap.week_batch.items[0]?.base_date_from ?? snap.compare_date_from;
  const compareTo =
    snap.week_batch.items[0]?.base_date_to ?? snap.compare_date_to;

  return {
    weekStart: snap.week_start,
    weekEnd: snap.week_end,
    prevWeekStart: compareFrom,
    prevWeekEnd: compareTo,
    comparison: 'lfl',
    workingDays: active.length,
    avgDailyRevenue: revenue / daysInWeek,
    avgDailyChecks: checks / daysInWeek,
    avgDailyGuests: guests / daysInWeek,
    avgCheckMin: avgChecks.length ? Math.min(...avgChecks) : 0,
    avgCheckMax: avgChecks.length ? Math.max(...avgChecks) : 0,
    peakDay,
    weakDay,
    monthRevenueSharePct:
      monthRevenue > 0 ? Math.round((revenue / monthRevenue) * 1000) / 10 : null,
  };
}

/** Месяцы точек revenue в month_series; иначе месяцы от date_from до date_to. */
export function monthsInRevenueSeries(snap: MetricSnapshotApi): number[] {
  const revenue = seriesByMetric(snap.month_series).get('revenue');
  if (revenue?.points.length) {
    return [...new Set(revenue.points.map((point) => parseIsoDate(point.date).getMonth() + 1))];
  }
  const from = parseIsoDate(snap.date_from);
  const to = parseIsoDate(snap.date_to);
  if (from.getFullYear() !== to.getFullYear()) {
    return Array.from({ length: 12 }, (_, i) => i + 1);
  }
  const start = from.getMonth() + 1;
  const end = to.getMonth() + 1;
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);
}

function loadMonthPlansMap(
  targets: TargetsRepository,
  year: number,
  months: number[],
): Observable<Map<number, number>> {
  const unique = [...new Set(months)].filter((month) => month >= 1 && month <= 12);
  if (unique.length === 0) return of(new Map());
  return forkJoin(
    unique.map((month) =>
      targets.fetch({ year, month }).pipe(
        map((data) => ({ month, plan: data.revenue.monthPlan })),
        catchError(() => of({ month, plan: 0 })),
      ),
    ),
  ).pipe(
    map((rows) => {
      const plans = new Map<number, number>();
      for (const row of rows) {
        if (row.plan > 0) plans.set(row.month, row.plan);
      }
      return plans;
    }),
  );
}

function snapshotToDashboard(
  snap: MetricSnapshotApi,
  targets: TargetsData | null,
  mode: SnapshotMode,
  monthPlansOverride?: Map<number, number>,
): DashboardApi {
  const dayPlans = buildDayPlans(targets, snap.date_from, snap.date_to);
  const monthPlans = monthPlansOverride ?? new Map<number, number>();
  if (!monthPlansOverride && targets && targets.revenue.monthPlan > 0) {
    monthPlans.set(targets.period.month, targets.revenue.monthPlan);
  }

  const day = seriesByMetric(snap.day_series);
  const month = seriesByMetric(snap.month_series);
  const forecasts = snap.forecasts;
  const revFc = forecasts.find((item) => item.metric === 'revenue');

  let comparePeriod = isoToApiPeriod(snap.compare_date_from, snap.compare_date_to);
  let units = mapUnits(snap.week_units ?? snap.units);
  let kpis = mode === 'chart' ? emptyKpis() : buildKpis(snap.batch, forecasts);
  let weekKpi: WeekKpiContext | null = null;

  if (snap.week_batch) {
    weekKpi = buildWeekKpi(snap);
    comparePeriod = isoToApiPeriod(
      snap.week_batch.items[0]?.base_date_from ?? snap.compare_date_from,
      snap.week_batch.items[0]?.base_date_to ?? snap.compare_date_to,
    );
    if (mode !== 'chart') {
      const byMetric = batchByMetric(snap.week_batch);
      kpis = {
        revenue: {
          value: num(byMetric.get('revenue')?.value),
          prevValue: byMetric.get('revenue')?.base_value ?? null,
          forecast: null,
          forecastToday: null,
        },
        checks: {
          value: num(byMetric.get('checks')?.value),
          prevValue: byMetric.get('checks')?.base_value ?? null,
          forecast: null,
          forecastToday: null,
        },
        guests: {
          value: num(byMetric.get('guests')?.value),
          prevValue: byMetric.get('guests')?.base_value ?? null,
          forecast: null,
          forecastToday: null,
        },
        avgCheck: {
          value: num(byMetric.get('avg-check')?.value),
          prevValue: byMetric.get('avg-check')?.base_value ?? null,
          forecast: null,
          forecastToday: null,
        },
      };
    }
  }

  return {
    period: isoToApiPeriod(snap.date_from, snap.date_to),
    compare: comparePeriod,
    dataBounds: {
      earliest: snap.bounds.date_from,
      latest: snap.bounds.date_to,
    },
    kpis,
    revenueByDay:
      mode === 'kpi'
        ? []
        : buildRevenueByDay(
            day.get('revenue'),
            day.get('checks'),
            day.get('guests'),
            mode === 'chart' ? undefined : revFc,
            dayPlans,
          ),
    revenueByMonth:
      mode === 'kpi'
        ? []
        : buildRevenueByMonth(
            month.get('revenue'),
            month.get('checks'),
            month.get('guests'),
            monthPlans,
            mode === 'chart' ? undefined : revFc,
          ),
    units,
    weekKpi,
    reviews: null,
    stock: null,
  };
}

function loadTargetsOptional(
  targets: TargetsRepository,
  year: number,
  month: number,
): Observable<TargetsData | null> {
  return targets.fetch({ year, month }).pipe(catchError(() => of(null)));
}

/** Один HTTP snapshot: период резолвит бэкенд (year/month или default). */
function queryToSnapshotOptions(
  query: DashboardQueryKey,
  mode: SnapshotMode,
): {
  mode: SnapshotMode;
  year?: number;
  month?: number;
  baseFrom?: string;
  baseTo?: string;
  weekStart?: string;
  weekEnd?: string;
  anchorYear?: number;
  anchorMonth?: number;
} {
  const options: {
    mode: SnapshotMode;
    year?: number;
    month?: number;
    baseFrom?: string;
    baseTo?: string;
    weekStart?: string;
    weekEnd?: string;
    anchorYear?: number;
    anchorMonth?: number;
  } = { mode };

  if (query.year != null) options.year = query.year;
  if (query.month != null) options.month = query.month;
  if (query.compareStart && query.compareEnd) {
    options.baseFrom = query.compareStart;
    options.baseTo = query.compareEnd;
  }
  if (query.weekStart && query.weekEnd) {
    options.weekStart = query.weekStart;
    options.weekEnd = query.weekEnd;
    options.anchorYear = query.year;
    options.anchorMonth = query.month;
  }
  return options;
}

function assembleMode(
  deps: DashboardAssembleDeps,
  query: DashboardQueryKey,
  mode: SnapshotMode,
): Observable<{ data: DashboardApi; etag: string | null }> {
  return deps.metrics.getSnapshot(queryToSnapshotOptions(query, mode)).pipe(
    switchMap((response) => {
      if (response.status === 304) {
        throw new Error('Unexpected 304 without prior etag body');
      }
      const snap = response.body;
      if (!snap) throw new Error('snapshot body is empty');
      const year = parseIsoDate(snap.date_from).getFullYear();
      const monthFrom = parseIsoDate(snap.date_from).getMonth() + 1;
      const monthTo = parseIsoDate(snap.date_to).getMonth() + 1;
      const etag = response.headers.get('ETag');
      /** Год: планы нужны по каждому месяцу серии, не только по month(date_from). */
      const yearMode = query.year != null && query.month == null;

      if (yearMode && mode !== 'kpi') {
        return forkJoin({
          monthPlans: loadMonthPlansMap(deps.targets, year, monthsInRevenueSeries(snap)),
          dayTargets: loadTargetsOptional(deps.targets, year, monthTo),
        }).pipe(
          map(({ monthPlans, dayTargets }) => ({
            data: snapshotToDashboard(snap, dayTargets, mode, monthPlans),
            etag,
          })),
        );
      }

      return loadTargetsOptional(deps.targets, year, monthFrom).pipe(
        map((targets) => ({
          data: snapshotToDashboard(snap, targets, mode),
          etag,
        })),
      );
    }),
  );
}

export function assembleDashboardFull(
  deps: DashboardAssembleDeps,
  query: DashboardQueryKey,
): Observable<{ data: DashboardApi; etag: string | null }> {
  return assembleMode(deps, query, 'full');
}

export function assembleDashboardChart(
  deps: DashboardAssembleDeps,
  query: DashboardQueryKey,
): Observable<{ data: DashboardChartApi; etag: string | null }> {
  return assembleMode(deps, query, 'chart').pipe(
    map(({ data, etag }) => ({
      data: {
        period: data.period,
        compare: data.compare,
        dataBounds: data.dataBounds,
        revenueByDay: data.revenueByDay,
        revenueByMonth: data.revenueByMonth,
        units: data.units,
        weekKpi: data.weekKpi,
      },
      etag,
    })),
  );
}

export function assembleDashboardKpi(
  deps: DashboardAssembleDeps,
  query: DashboardQueryKey,
): Observable<{ data: DashboardKpiApi; etag: string | null }> {
  return assembleMode(deps, query, 'kpi').pipe(
    map(({ data, etag }) => ({
      data: {
        period: data.period,
        compare: data.compare,
        kpis: data.kpis,
        weekKpi: data.weekKpi,
      },
      etag,
    })),
  );
}
