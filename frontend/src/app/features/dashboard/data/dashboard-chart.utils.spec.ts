import type { ChartPeriodSelection } from '../../../shared/models/chart-period.model';
import {
  aggregateKpisFromRevenueDays,
  aggregateKpisFromRevenueMonths,
  applyYearTimeframeKpis,
  chartApiToDashboardApi,
  chartFetchNeeded,
  chartSliceMatchesSelection,
  dashboardChartCacheKey,
  mergeDashboardChartData,
  mergeCompareOverlay,
  pickDashboardCompareSlice,
  resolveEffectiveChartSelection,
  resolveMergedChartData,
} from './dashboard-chart.utils';
import type { DashboardApi } from '../../../shared/models/dashboard-api.model';

const basePeriod = { year: 2026, month: 6, dayFrom: 1, dayTo: 11 };

const basePayload = {
  period: basePeriod,
  compare: basePeriod,
  dataBounds: { earliest: null, latest: null },
  kpis: {
    revenue: { value: 100, prevValue: 90, forecast: 200, forecastToday: null },
    checks: { value: 10, prevValue: 9, forecast: 20, forecastToday: null },
    guests: { value: 20, prevValue: 18, forecast: 40, forecastToday: null },
    avgCheck: { value: 10, prevValue: 9, forecast: 11, forecastToday: null },
  },
  revenueByDay: [{ day: 1, weekday: 1, revenue: 100, checks: 1, guests: 1, plan: null, forecast: null }],
  revenueByMonth: [{ month: 6, revenue: 100, checks: 1, guests: 1, plan: null, forecast: null }],
  units: [],
  reviews: null,
  stock: null,
} satisfies DashboardApi;

describe('dashboard-chart.utils', () => {
  it('dashboardChartCacheKey encodes year and month modes with tenant scope', () => {
    const selection: ChartPeriodSelection = { year: 2026, month: 5 };
    expect(dashboardChartCacheKey('user-1', selection, 'month')).toBe('user-1:v8:m:2026-5');
    expect(dashboardChartCacheKey('user-1', selection, 'year')).toBe('user-1:v8:y:2026');
  });

  it('chartFetchNeeded is false when selection matches base period in month mode', () => {
    expect(chartFetchNeeded({ year: 2026, month: 6 }, 'month', basePeriod)).toBe(false);
  });

  it('chartFetchNeeded is always true in week mode', () => {
    expect(chartFetchNeeded({ year: 2026, month: 6 }, 'week', basePeriod)).toBe(true);
    expect(
      chartFetchNeeded(
        { year: 2026, month: 6, weekStartDate: '2026-06-08', weekEndDate: '2026-06-14' },
        'week',
        basePeriod,
      ),
    ).toBe(true);
  });

  it('resolveEffectiveChartSelection resolves implicit week range in week mode', () => {
    const bounds = { earliest: '2026-06-01', latest: '2026-06-11' };
    const resolved = resolveEffectiveChartSelection(null, 'week', basePeriod, bounds);
    expect(resolved.weekStartDate).toBeDefined();
    expect(resolved.weekEndDate).toBeDefined();
  });

  it('chartSliceMatchesSelection rejects week overlay for month granularity', () => {
    expect(
      chartSliceMatchesSelection(
        {
          period: basePeriod,
          compare: basePeriod,
          kpis: basePayload.kpis,
          revenueByDay: basePayload.revenueByDay,
          revenueByMonth: basePayload.revenueByMonth,
          dataBounds: basePayload.dataBounds,
          weekKpi: {
            weekStart: '2026-06-08',
            weekEnd: '2026-06-14',
            prevWeekStart: '2026-06-01',
            prevWeekEnd: '2026-06-07',
            comparison: 'lfl',
            workingDays: 7,
            avgDailyRevenue: 100,
            avgDailyChecks: 1,
            avgDailyGuests: 2,
            avgCheckMin: 100,
            avgCheckMax: 100,
            peakDay: null,
            weakDay: null,
            monthRevenueSharePct: null,
          },
        },
        { year: 2026, month: 6 },
        'month',
      ),
    ).toBe(false);
  });

  it('chartFetchNeeded is always true in year mode', () => {
    expect(chartFetchNeeded({ year: 2026, month: 6 }, 'year', basePeriod)).toBe(true);
    expect(chartFetchNeeded({ year: 2026, month: 1 }, 'year', basePeriod)).toBe(true);
  });

  it('resolveEffectiveChartSelection defaults year in year mode', () => {
    expect(resolveEffectiveChartSelection(null, 'year', basePeriod)).toEqual({
      year: 2026,
      month: 1,
    });
  });

  it('applyYearTimeframeKpis sums YTD from revenueByMonth', () => {
    const data = {
      ...basePayload,
      revenueByMonth: [
        { month: 1, revenue: 100, checks: 1, guests: 2, plan: null, forecast: null },
        { month: 2, revenue: 200, checks: 3, guests: 4, plan: null, forecast: null },
      ],
    };
    const adjusted = applyYearTimeframeKpis(data);
    expect(adjusted.kpis.revenue.value).toBe(300);
    expect(adjusted.kpis.checks.value).toBe(4);
    expect(adjusted.kpis.avgCheck.value).toBe(75);
  });

  it('aggregateKpisFromRevenueMonths sums monthly metrics', () => {
    const kpis = aggregateKpisFromRevenueMonths([
      { month: 6, revenue: 100, checks: 2, guests: 4, plan: null, forecast: null },
      { month: 7, revenue: 300, checks: 6, guests: 8, plan: null, forecast: null },
    ]);
    expect(kpis.revenue.value).toBe(400);
    expect(kpis.checks.value).toBe(8);
  });

  it('mergeDashboardChartData uses KPIs from chart slice', () => {
    const mayKpis = {
      revenue: { value: 50, prevValue: 40, forecast: null, forecastToday: null },
      checks: { value: 5, prevValue: 4, forecast: null, forecastToday: null },
      guests: { value: 10, prevValue: 8, forecast: null, forecastToday: null },
      avgCheck: { value: 10, prevValue: 9, forecast: null, forecastToday: null },
    };
    const merged = mergeDashboardChartData(basePayload, {
      period: { year: 2026, month: 5, dayFrom: 1, dayTo: 31 },
      compare: { year: 2026, month: 4, dayFrom: 1, dayTo: 30 },
      kpis: mayKpis,
      revenueByDay: [{ day: 1, weekday: 1, revenue: 1, checks: 1, guests: 1, plan: null, forecast: null }],
      revenueByMonth: [],
      dataBounds: { earliest: '2026-05-01', latest: '2026-05-31' },
    });

    expect(merged.kpis.revenue.value).toBe(50);
    expect(merged.period.month).toBe(5);
    expect(merged.revenueByDay).toHaveLength(1);
  });

  it('chartSliceMatchesSelection compares by year or month', () => {
    const maySlice = {
      period: { year: 2026, month: 5, dayFrom: 1, dayTo: 31 },
      compare: { year: 2026, month: 4, dayFrom: 1, dayTo: 30 },
      kpis: basePayload.kpis,
      revenueByDay: [],
      revenueByMonth: [],
      dataBounds: { earliest: null, latest: null },
    };
    expect(chartSliceMatchesSelection(maySlice, { year: 2026, month: 5 }, 'month')).toBe(true);
    expect(chartSliceMatchesSelection(maySlice, { year: 2026, month: 6 }, 'month')).toBe(false);
    expect(chartSliceMatchesSelection(maySlice, { year: 2026, month: 1 }, 'year')).toBe(true);
    expect(chartSliceMatchesSelection(maySlice, { year: 2025, month: 5 }, 'year')).toBe(false);
  });

  it('resolveMergedChartData uses base when selection matches KPI period', () => {
    const result = resolveMergedChartData(
      basePayload,
      { year: 2026, month: 6 },
      'month',
      null,
      null,
    );
    expect(result.revenueByDay[0].revenue).toBe(100);
  });

  it('resolveMergedChartData returns empty series while slice is loading', () => {
    const loading = resolveMergedChartData(
      basePayload,
      { year: 2026, month: 5 },
      'month',
      null,
      'user-1:v8:m:2026-5',
    );
    expect(loading.revenueByDay).toEqual([]);
    expect(loading.kpis.revenue.value).toBe(0);
    expect(loading.kpis.revenue.prevValue).toBeNull();
    expect(loading.compare).toEqual({ year: 2026, month: 4, dayFrom: 1, dayTo: 30 });
    expect(loading.period.month).toBe(5);

    const mayKpis = {
      revenue: { value: 50, prevValue: 40, forecast: null, forecastToday: null },
      checks: { value: 5, prevValue: 4, forecast: null, forecastToday: null },
      guests: { value: 10, prevValue: 8, forecast: null, forecastToday: null },
      avgCheck: { value: 10, prevValue: 9, forecast: null, forecastToday: null },
    };
    const maySlice = {
      period: { year: 2026, month: 5, dayFrom: 1, dayTo: 31 },
      compare: { year: 2026, month: 4, dayFrom: 1, dayTo: 30 },
      kpis: mayKpis,
      revenueByDay: [{ day: 1, weekday: 1, revenue: 5, checks: 1, guests: 1, plan: null, forecast: null }],
      revenueByMonth: [],
      dataBounds: { earliest: null, latest: null },
    };
    const ready = resolveMergedChartData(
      basePayload,
      { year: 2026, month: 5 },
      'month',
      maySlice,
      'user-1:v8:m:2026-5',
    );
    expect(ready.revenueByDay[0].revenue).toBe(5);
    expect(ready.kpis.revenue.value).toBe(50);
  });

  it('aggregateKpisFromRevenueDays sums week days', () => {
    const kpis = aggregateKpisFromRevenueDays([
      { day: 8, weekday: 1, revenue: 100, checks: 2, guests: 4, plan: null, forecast: null },
      { day: 9, weekday: 2, revenue: 200, checks: 3, guests: 6, plan: null, forecast: null },
    ]);
    expect(kpis.revenue.value).toBe(300);
    expect(kpis.checks.value).toBe(5);
    expect(kpis.avgCheck.value).toBe(60);
    expect(kpis.revenue.prevValue).toBeNull();
  });

  it('chartFetchNeeded is true for week selection with dates', () => {
    expect(
      chartFetchNeeded(
        {
          year: 2026,
          month: 6,
          weekStartDate: '2026-06-08',
          weekEndDate: '2026-06-14',
        },
        'week',
        basePeriod,
      ),
    ).toBe(true);
  });

  it('chartSliceMatchesSelection matches week overlay slice', () => {
    expect(
      chartSliceMatchesSelection(
        {
          period: basePeriod,
          compare: basePeriod,
          kpis: basePayload.kpis,
          revenueByDay: basePayload.revenueByDay,
          revenueByMonth: basePayload.revenueByMonth,
          dataBounds: basePayload.dataBounds,
          weekKpi: {
            weekStart: '2026-06-08',
            weekEnd: '2026-06-14',
            prevWeekStart: '2026-06-01',
            prevWeekEnd: '2026-06-07',
            comparison: 'lfl',
            workingDays: 7,
            avgDailyRevenue: 100,
            avgDailyChecks: 1,
            avgDailyGuests: 2,
            avgCheckMin: 100,
            avgCheckMax: 100,
            peakDay: null,
            weakDay: null,
            monthRevenueSharePct: null,
          },
        },
        {
          year: 2026,
          month: 6,
          weekStartDate: '2026-06-08',
          weekEndDate: '2026-06-14',
        },
        'week',
      ),
    ).toBe(true);
  });

  it('resolveMergedChartData keeps base monthly series for current year while loading', () => {
    const result = resolveMergedChartData(
      basePayload,
      { year: 2026, month: 1 },
      'year',
      null,
      'user-1:v8:y:2026',
    );
    expect(result.revenueByDay).toEqual([]);
    expect(result.revenueByMonth).toEqual(basePayload.revenueByMonth);
  });

  it('resolveMergedChartData does not reuse base chart when another period is selected', () => {
    const result = resolveMergedChartData(
      basePayload,
      { year: 2025, month: 1 },
      'year',
      null,
      'user-1:v8:y:2025',
    );
    expect(result.revenueByDay).toEqual([]);
    expect(result.revenueByMonth).toEqual([]);
    expect(result.kpis.revenue.value).toBe(0);
  });

  it('chartApiToDashboardApi fills placeholder KPI', () => {
    const chart = {
      period: basePeriod,
      compare: basePeriod,
      dataBounds: basePayload.dataBounds,
      revenueByDay: basePayload.revenueByDay,
      revenueByMonth: basePayload.revenueByMonth,
      units: basePayload.units,
      weekKpi: null,
    };
    const mapped = chartApiToDashboardApi(chart);
    expect(mapped.kpis.revenue.value).toBe(0);
    expect(mapped.kpis.revenue.prevValue).toBeNull();
    expect(mapped.revenueByDay).toEqual(basePayload.revenueByDay);
    expect(mapped.reviews).toBeNull();
  });

  it('mergeCompareOverlay updates KPI and compare without touching chart series', () => {
    const overlay = pickDashboardCompareSlice({
      ...basePayload,
      compare: { year: 2026, month: 5, dayFrom: 1, dayTo: 11 },
      kpis: {
        revenue: { value: 100, prevValue: 50, forecast: 200, forecastToday: null },
        checks: { value: 10, prevValue: 5, forecast: 20, forecastToday: null },
        guests: { value: 20, prevValue: 10, forecast: 40, forecastToday: null },
        avgCheck: { value: 10, prevValue: 5, forecast: 11, forecastToday: null },
      },
    });

    const merged = mergeCompareOverlay(basePayload, overlay);

    expect(merged.kpis.revenue.prevValue).toBe(50);
    expect(merged.compare.month).toBe(5);
    expect(merged.revenueByDay).toEqual(basePayload.revenueByDay);
    expect(merged.revenueByMonth).toEqual(basePayload.revenueByMonth);
  });
});
