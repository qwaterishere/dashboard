import { buildPeriodInfo, buildWeekRevenueDays, formatChartPeriodRange, formatCompareWith, formatIsoWeekRangeLabel, formatPeriodRange, filterRevenueDays, formatYearPeriodLabel, inferComparePeriod } from './period-format.utils';
import type { RevenueDayFact } from '../models/dashboard-api.model';

describe('period-format.utils', () => {
  const period = { year: 2026, month: 6, dayFrom: 1, dayTo: 11 };
  const compare = { year: 2026, month: 5, dayFrom: 1, dayTo: 11 };

  it('formats period range', () => {
    expect(formatPeriodRange(period)).toBe('1–11 июня 2026');
    expect(formatPeriodRange({ ...period, dayFrom: 5, dayTo: 5 })).toBe('5 июня 2026');
  });

  it('infers previous month compare for partial and full periods', () => {
    expect(inferComparePeriod({ year: 2026, month: 6, dayFrom: 1, dayTo: 11 })).toEqual({
      year: 2026,
      month: 5,
      dayFrom: 1,
      dayTo: 11,
    });
    expect(inferComparePeriod({ year: 2026, month: 6, dayFrom: 1, dayTo: 30 })).toEqual({
      year: 2026,
      month: 5,
      dayFrom: 1,
      dayTo: 31,
    });
  });

  it('formats compare label', () => {
    expect(formatCompareWith(compare)).toBe('1–11 мая 2026');
  });

  it('builds PeriodInfo for shell', () => {
    expect(buildPeriodInfo(period, compare)).toEqual({
      label: '1–11 июня 2026',
      note: 'закрытые дни',
      compareWith: '1–11 мая 2026',
    });
  });

  it('filters revenue days for week granularity', () => {
    const days: RevenueDayFact[] = Array.from({ length: 11 }, (_, i) => ({
      day: i + 1,
      weekday: 1,
      revenue: 0,
      checks: 0,
      guests: 0,
      plan: null, forecast: null,
    }));
    expect(filterRevenueDays(days, period, 'week')).toHaveLength(7);
    expect(filterRevenueDays(days, period, 'week').map((d) => d.day)).toEqual([
      8, 9, 10, 11, 12, 13, 14,
    ]);
    expect(filterRevenueDays(days, period, 'year')).toHaveLength(11);
  });

  it('buildWeekRevenueDays pads missing days with zeros', () => {
    const days: RevenueDayFact[] = [
      { day: 9, weekday: 2, revenue: 100, checks: 1, guests: 1, plan: null, forecast: null },
      { day: 11, weekday: 4, revenue: 50, checks: 1, guests: 1, plan: null, forecast: null },
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
