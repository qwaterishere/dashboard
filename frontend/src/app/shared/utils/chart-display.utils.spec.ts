import type { DashboardV2 } from '../models/dashboard-v2.model';
import { buildChartDisplaySeries } from './chart-display.utils';

const period: DashboardV2['period'] = { year: 2026, month: 6, dayFrom: 1, dayTo: 30 };

const daily = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  weekday: (i + 1) % 7,
  revenue: (i + 1) * 100,
  checks: 1,
  guests: 2,
  plan: null,
}));

const monthly = [
  { month: 1, revenue: 1000, checks: 10, guests: 20, plan: null },
  { month: 2, revenue: 2000, checks: 20, guests: 40, plan: null },
  { month: 3, revenue: 3000, checks: 30, guests: 60, plan: null },
  { month: 4, revenue: 4000, checks: 40, guests: 80, plan: null },
];

describe('chart-display.utils', () => {
  it('builds day series for month timeframe', () => {
    const series = buildChartDisplaySeries(
      { daily, monthly, period, timeframe: 'month' },
      'day',
    );
    expect(series).toHaveLength(30);
    expect(series[0].day).toBe(1);
  });

  it('builds week series for month timeframe', () => {
    const series = buildChartDisplaySeries(
      { daily, monthly, period, timeframe: 'month' },
      'week',
    );
    expect(series.length).toBeGreaterThan(3);
    expect(series[0].barLabel).toBeTruthy();
  });

  it('builds quarter series for year timeframe', () => {
    const series = buildChartDisplaySeries(
      { daily: [], monthly, period: { ...period, month: 1, dayFrom: 1, dayTo: 31 }, timeframe: 'year' },
      'quarter',
    );
    expect(series).toHaveLength(4);
    expect(series[0].barLabel).toBe('Q1');
    expect(series[0].revenue).toBe(6000);
    expect(series[1].revenue).toBe(4000);
  });

  it('builds single week bar for week timeframe', () => {
    const weekDaily = daily.slice(0, 7);
    const series = buildChartDisplaySeries(
      {
        daily: weekDaily,
        monthly,
        period: { ...period, dayFrom: 1, dayTo: 7 },
        timeframe: 'week',
        weekRange: { startDate: '2026-06-01', endDate: '2026-06-07' },
      },
      'week',
    );
    expect(series).toHaveLength(1);
    expect(series[0].revenue).toBe(2800);
  });

  it('uses weekday labels for cross-month week day series', () => {
    const series = buildChartDisplaySeries(
      {
        daily: [],
        monthly,
        period: { year: 2026, month: 2, dayFrom: 23, dayTo: 28 },
        timeframe: 'week',
        weekRange: { startDate: '2026-02-23', endDate: '2026-03-01' },
        weekDayLookup: () => undefined,
      },
      'day',
    );
    expect(series).toHaveLength(7);
    expect(series.every((bar) => !bar.barLabel)).toBe(true);
    expect(series.map((bar) => bar.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });
});
