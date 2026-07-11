import { buildPeriodInfo, buildWeekRevenueDays, formatChartPeriodRange, formatCompareWith, formatIsoWeekRangeLabel, formatPeriodRange, filterRevenueDays, formatYearPeriodLabel } from './period-format.utils';
import type { RevenueDayV2 } from '../models/dashboard-v2.model';

describe('period-format.utils', () => {
  const period = { year: 2026, month: 6, dayFrom: 1, dayTo: 11 };
  const compare = { year: 2025, month: 6, dayFrom: 1, dayTo: 11 };

  it('formats period range', () => {
    expect(formatPeriodRange(period)).toBe('1–11 июня 2026');
    expect(formatPeriodRange({ ...period, dayFrom: 5, dayTo: 5 })).toBe('5 июня 2026');
  });

  it('formats compare label', () => {
    expect(formatCompareWith(compare)).toBe('июнем 2025');
  });

  it('builds PeriodInfo for shell', () => {
    expect(buildPeriodInfo(period, compare)).toEqual({
      label: '1–11 июня 2026',
      note: 'закрытые дни',
      compareWith: 'июнем 2025',
    });
  });

  it('filters revenue days for week granularity', () => {
    const days: RevenueDayV2[] = Array.from({ length: 11 }, (_, i) => ({
      day: i + 1,
      weekday: 1,
      revenue: 0,
      checks: 0,
      guests: 0,
      plan: null,
    }));
    expect(filterRevenueDays(days, period, 'week')).toHaveLength(7);
    expect(filterRevenueDays(days, period, 'week').map((d) => d.day)).toEqual([
      8, 9, 10, 11, 12, 13, 14,
    ]);
    expect(filterRevenueDays(days, period, 'year')).toHaveLength(11);
  });

  it('buildWeekRevenueDays pads missing days with zeros', () => {
    const days: RevenueDayV2[] = [
      { day: 9, weekday: 2, revenue: 100, checks: 1, guests: 1, plan: null },
      { day: 11, weekday: 4, revenue: 50, checks: 1, guests: 1, plan: null },
    ];
    const week = buildWeekRevenueDays(days, period, {
      startDate: '2026-06-08',
      endDate: '2026-06-14',
    });
    expect(week.map((d) => d.day)).toEqual([8, 9, 10, 11, 12, 13, 14]);
    expect(week.find((d) => d.day === 10)?.revenue).toBe(0);
    expect(week.find((d) => d.day === 9)?.revenue).toBe(100);
  });

  it('formats year period label with short months', () => {
    expect(formatYearPeriodLabel(2026, 1, 6)).toBe('янв–июн 2026');
  });

  it('formatChartPeriodRange uses short month names', () => {
    expect(formatChartPeriodRange(period)).toBe('1–11 июн 2026');
  });

  it('formatIsoWeekRangeLabel uses short month names for cross-month weeks', () => {
    expect(
      formatIsoWeekRangeLabel({ startDate: '2026-02-23', endDate: '2026-03-01' }),
    ).toBe('23 фев – 1 мар 2026');
  });
});
