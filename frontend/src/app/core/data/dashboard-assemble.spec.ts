import { firstValueFrom, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  assembleDashboardChart,
  monthsInRevenueSeries,
  resolveDashboardPeriod,
  type DashboardAssembleDeps,
} from './dashboard-assemble';
import type { MetricSnapshotApi } from '../../shared/models/base-metrics-api.model';
import type { TargetsData } from '../../shared/models/targets.model';
import { previousPeriodRange } from '../../shared/utils/iso-date.utils';

describe('resolveDashboardPeriod', () => {
  const bounds = { date_from: '2026-01-10', date_to: '2026-06-11' };

  it('uses default month range when query is empty', () => {
    const period = resolveDashboardPeriod(
      {},
      bounds,
      { date_from: '2026-06-01', date_to: '2026-06-11' },
    );
    expect(period.dateFrom).toBe('2026-06-01');
    expect(period.dateTo).toBe('2026-06-11');
    expect(period.yearMode).toBe(false);
  });

  it('clips current month to latest', () => {
    const period = resolveDashboardPeriod({ year: 2026, month: 6 }, bounds, null);
    expect(period.dateFrom).toBe('2026-06-01');
    expect(period.dateTo).toBe('2026-06-11');
  });

  it('uses full past month', () => {
    const period = resolveDashboardPeriod({ year: 2026, month: 5 }, bounds, null);
    expect(period.dateFrom).toBe('2026-05-01');
    expect(period.dateTo).toBe('2026-05-31');
  });

  it('resolves year mode to YTD', () => {
    const period = resolveDashboardPeriod({ year: 2026 }, bounds, null);
    expect(period.dateFrom).toBe('2026-01-01');
    expect(period.dateTo).toBe('2026-06-11');
    expect(period.yearMode).toBe(true);
  });
});

describe('previousPeriodRange', () => {
  it('maps partial month to previous month same days', () => {
    expect(previousPeriodRange('2026-06-01', '2026-06-11')).toEqual({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-11',
    });
  });

  it('maps full month to previous full month', () => {
    expect(previousPeriodRange('2026-06-01', '2026-06-30')).toEqual({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
    });
  });
});

function emptyTargets(year: number, month: number, monthPlan = 0): TargetsData {
  return {
    period: { year, month, label: String(month) },
    reference: { label: '', revenueFact: 0, revenuePace: 0 },
    revenue: { monthPlan, weekProfile: [1, 1, 1, 1, 1, 1, 1] },
    dailyOverrides: {},
    foodcost: [],
    writeoffs: [],
    compliments: { mode: 'pct', goalPct: 0, goalRub: 0, factPct: 0, factRub: 0 },
    inventory: { mode: 'pct', goalPct: 0, goalRub: 0, note: '' },
    locked: false,
  };
}

function yearSnapshot(): MetricSnapshotApi {
  return {
    mode: 'chart',
    bounds: { date_from: '2026-01-01', date_to: '2026-07-23' },
    date_from: '2026-01-01',
    date_to: '2026-07-23',
    compare_date_from: '2025-01-01',
    compare_date_to: '2025-07-23',
    batch: { items: [] },
    units: {
      date_from: '2026-01-01',
      date_to: '2026-07-23',
      base_date_from: '2025-01-01',
      base_date_to: '2025-07-23',
      units: [],
    },
    day_series: [],
    month_series: [
      {
        metric: 'revenue',
        unit: 'money',
        date_from: '2026-01-01',
        date_to: '2026-07-01',
        granularity: 'month',
        points: [
          { date: '2026-01-01', value: 1_000_000 },
          { date: '2026-07-01', value: 500_000 },
        ],
      },
      {
        metric: 'checks',
        unit: 'count',
        date_from: '2026-01-01',
        date_to: '2026-07-01',
        granularity: 'month',
        points: [
          { date: '2026-01-01', value: 100 },
          { date: '2026-07-01', value: 50 },
        ],
      },
      {
        metric: 'guests',
        unit: 'count',
        date_from: '2026-01-01',
        date_to: '2026-07-01',
        granularity: 'month',
        points: [
          { date: '2026-01-01', value: 200 },
          { date: '2026-07-01', value: 100 },
        ],
      },
    ],
    forecasts: [],
    week_start: null,
    week_end: null,
    week_batch: null,
    week_units: null,
    week_day_series: [],
    month_revenue: null,
  };
}

describe('monthsInRevenueSeries', () => {
  it('reads months from month_series points', () => {
    expect(monthsInRevenueSeries(yearSnapshot())).toEqual([1, 7]);
  });
});

describe('assembleDashboardChart year plans', () => {
  it('attaches July plan even when YTD starts in January', async () => {
    const metrics = {
      getSnapshot: vi.fn(() =>
        of({
          body: yearSnapshot(),
          status: 200,
          headers: { get: (name: string) => (name === 'ETag' ? 'W/"y"' : null) },
        }),
      ),
    };
    const targets = {
      fetch: vi.fn(({ year, month }: { year?: number; month?: number }) =>
        of(emptyTargets(year ?? 2026, month ?? 1, month === 7 ? 9_000_000 : 0)),
      ),
    };
    const deps = { metrics, targets } as unknown as DashboardAssembleDeps;

    const result = await firstValueFrom(assembleDashboardChart(deps, { year: 2026 }));
    const july = result.data.revenueByMonth.find((m) => m.month === 7);
    expect(july?.plan).toBe(9_000_000);
    expect(targets.fetch).toHaveBeenCalledWith({ year: 2026, month: 7 });
    expect(targets.fetch).toHaveBeenCalledWith({ year: 2026, month: 1 });
  });
});
