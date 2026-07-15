import type { DashboardApi, WeekKpiContext } from '../../../shared/models/dashboard-api.model';
import { buildWeekKpiFooters } from './dashboard-week.mapper';

const weekKpi: WeekKpiContext = {
  weekStart: '2026-06-08',
  weekEnd: '2026-06-14',
  prevWeekStart: '2026-06-01',
  prevWeekEnd: '2026-06-07',
  comparison: 'lfl',
  workingDays: 7,
  avgDailyRevenue: 1143,
  avgDailyChecks: 2,
  avgDailyGuests: 4,
  avgCheckMin: 500,
  avgCheckMax: 700,
  peakDay: {
    date: '2026-06-09',
    weekday: 2,
    revenue: 2000,
    checks: 2,
    guests: 4,
    avgCheck: 1000,
  },
  weakDay: {
    date: '2026-06-14',
    weekday: 0,
    revenue: 600,
    checks: 1,
    guests: 2,
    avgCheck: 600,
  },
  monthRevenueSharePct: 12.5,
};

const api: DashboardApi = {
  period: { year: 2026, month: 6, dayFrom: 1, dayTo: 30 },
  compare: { year: 2026, month: 6, dayFrom: 1, dayTo: 7 },
  dataBounds: { earliest: '2026-01-01', latest: '2026-06-14' },
  kpis: {
    revenue: { value: 8000, prevValue: 1200, forecast: null, forecastToday: null },
    checks: { value: 14, prevValue: 2, forecast: null, forecastToday: null },
    guests: { value: 28, prevValue: 4, forecast: null, forecastToday: null },
    avgCheck: { value: 571, prevValue: 600, forecast: null, forecastToday: null },
  },
  revenueByDay: [],
  revenueByMonth: [],
  units: [],
  weekKpi,
  reviews: null,
  stock: null,
};

describe('buildWeekKpiFooters', () => {
  it('builds week footers without replacing LfL popovers', () => {
    const footers = buildWeekKpiFooters(api, weekKpi);

    expect(footers.revenueWeekFooter.label).toBe('Средний день');
    expect(footers.revenueWeekFooter.subline).toBeUndefined();
    expect(footers.revWeekAvgDetail.title).toBe('Средний день — выручка');
    expect(footers.checksWeekFooter.headline).toBe('2');
  });
});
