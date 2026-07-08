import { buildPeriodInfo, formatCompareWith, formatPeriodRange, filterRevenueDays } from './period-format.utils';

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
    const days = Array.from({ length: 11 }, (_, i) => ({ day: i + 1 }));
    expect(filterRevenueDays(days, period, 'week')).toHaveLength(7);
  });
});
