import {
  CHART_MONTH_LABELS,
  chartPeriodSelectionForMonthDay,
  findWeekOptionForDay,
  getMonthDayLimits,
  isMonthInBounds,
  isYearInBounds,
  listAvailableYears,
  listWeekRangesInMonth,
  resolveCalendarWeekInMonth,
  resolveChartPeriodBounds,
  resolveDefaultChartMonth,
  resolveDefaultChartWeekSelection,
  resolveDefaultWeekForMonth,
  resolveDefaultWeekRange,
  isChartPeriodResetVisible,
  resolveLatestChartPeriodSelection,
  chartPeriodSelectionsEqual,
  clampChartMonthInYear,
  resolveWeekByIndexInMonth,
  weekIndexInMonth,
} from './chart-period.utils';

describe('chart-period.utils', () => {
  const bounds = {
    earliest: '2025-03-10',
    latest: '2026-08-22',
  };

  it('resolveChartPeriodBounds parses API range', () => {
    expect(resolveChartPeriodBounds(bounds)).toEqual({
      minYear: 2025,
      minMonth: 3,
      maxYear: 2026,
      maxMonth: 8,
    });
  });

  it('isMonthInBounds respects edges', () => {
    const limits = resolveChartPeriodBounds(bounds)!;
    expect(isMonthInBounds(2025, 2, limits)).toBe(false);
    expect(isMonthInBounds(2025, 3, limits)).toBe(true);
    expect(isMonthInBounds(2026, 8, limits)).toBe(true);
    expect(isMonthInBounds(2026, 9, limits)).toBe(false);
  });

  it('listAvailableYears returns inclusive years', () => {
    const limits = resolveChartPeriodBounds(bounds)!;
    expect(listAvailableYears(limits, 2026)).toEqual([2025, 2026]);
  });

  it('isYearInBounds checks range', () => {
    const limits = resolveChartPeriodBounds(bounds)!;
    expect(isYearInBounds(2024, limits)).toBe(false);
    expect(isYearInBounds(2025, limits)).toBe(true);
  });

  it('CHART_MONTH_LABELS has 12 entries', () => {
    expect(CHART_MONTH_LABELS).toHaveLength(12);
  });

  it('listWeekRangesInMonth uses full calendar weeks for June starting on Monday', () => {
    expect(listWeekRangesInMonth(2026, 6, null)).toEqual([
      { startDate: '2026-06-01', endDate: '2026-06-07', label: '1–7' },
      { startDate: '2026-06-08', endDate: '2026-06-14', label: '8–14' },
      { startDate: '2026-06-15', endDate: '2026-06-21', label: '15–21' },
      { startDate: '2026-06-22', endDate: '2026-06-28', label: '22–28' },
      { startDate: '2026-06-29', endDate: '2026-07-05', label: '29 июн – 5 июл' },
    ]);
  });

  it('listWeekRangesInMonth uses full weeks when month starts mid-week', () => {
    expect(listWeekRangesInMonth(2026, 3, null)).toEqual([
      { startDate: '2026-02-23', endDate: '2026-03-01', label: '23 фев – 1 мар' },
      { startDate: '2026-03-02', endDate: '2026-03-08', label: '2–8' },
      { startDate: '2026-03-09', endDate: '2026-03-15', label: '9–15' },
      { startDate: '2026-03-16', endDate: '2026-03-22', label: '16–22' },
      { startDate: '2026-03-23', endDate: '2026-03-29', label: '23–29' },
      { startDate: '2026-03-30', endDate: '2026-04-05', label: '30 мар – 5 апр' },
    ]);
  });

  it('listWeekRangesInMonth keeps full calendar weeks when bounds end mid-week', () => {
    const ranges = listWeekRangesInMonth(2026, 6, {
      earliest: '2026-06-05',
      latest: '2026-06-11',
    });
    expect(ranges).toEqual([
      { startDate: '2026-06-01', endDate: '2026-06-07', label: '1–7' },
      { startDate: '2026-06-08', endDate: '2026-06-14', label: '8–14' },
    ]);
  });

  it('listWeekRangesInMonth shows full weeks without phantom duplicate', () => {
    const julyBounds = { earliest: '2026-07-01', latest: '2026-07-10' };
    expect(listWeekRangesInMonth(2026, 7, julyBounds)).toEqual([
      { startDate: '2026-06-29', endDate: '2026-07-05', label: '29 июн – 5 июл' },
      { startDate: '2026-07-06', endDate: '2026-07-12', label: '6–12' },
    ]);
    expect(
      listWeekRangesInMonth(2026, 7, julyBounds, {
        startDate: '2026-07-06',
        endDate: '2026-07-12',
      }),
    ).toEqual([
      { startDate: '2026-06-29', endDate: '2026-07-05', label: '29 июн – 5 июл' },
      { startDate: '2026-07-06', endDate: '2026-07-12', label: '6–12' },
    ]);
  });

  it('listWeekRangesInMonth does not add ensureRange covered by calendar week', () => {
    expect(
      listWeekRangesInMonth(2026, 6, null, {
        startDate: '2026-06-08',
        endDate: '2026-06-14',
      }),
    ).toEqual([
      { startDate: '2026-06-01', endDate: '2026-06-07', label: '1–7' },
      { startDate: '2026-06-08', endDate: '2026-06-14', label: '8–14' },
      { startDate: '2026-06-15', endDate: '2026-06-21', label: '15–21' },
      { startDate: '2026-06-22', endDate: '2026-06-28', label: '22–28' },
      { startDate: '2026-06-29', endDate: '2026-07-05', label: '29 июн – 5 июл' },
    ]);
  });

  it('resolveDefaultWeekRange returns full calendar week containing dayTo', () => {
    expect(resolveDefaultWeekRange(2026, 6, 1, 11)).toEqual({
      startDate: '2026-06-08',
      endDate: '2026-06-14',
    });
  });

  it('resolveCalendarWeekInMonth finds full week for anchor day', () => {
    expect(resolveCalendarWeekInMonth(2026, 3, 5)).toEqual({
      startDate: '2026-03-02',
      endDate: '2026-03-08',
    });
  });

  it('findWeekOptionForDay matches containing week', () => {
    const options = listWeekRangesInMonth(2026, 6, null);
    expect(findWeekOptionForDay(options, 2026, 6, 11)).toEqual({
      startDate: '2026-06-08',
      endDate: '2026-06-14',
      label: '8–14',
    });
  });

  it('getMonthDayLimits respects earliest and latest in same month', () => {
    expect(
      getMonthDayLimits(2026, 6, { earliest: '2026-06-05', latest: '2026-06-11' }),
    ).toEqual({ minDay: 5, maxDay: 11 });
  });

  it('resolveDefaultChartMonth picks latest month for current year', () => {
    const bounds = { earliest: '2025-03-10', latest: '2026-08-22' };
    const period = { year: 2026, month: 6, dayFrom: 1, dayTo: 11 };
    expect(resolveDefaultChartMonth(2026, bounds, period)).toBe(8);
    expect(resolveDefaultChartMonth(2025, bounds, period)).toBe(3);
  });

  it('resolveDefaultChartWeekSelection picks latest week for current year', () => {
    const bounds = { earliest: '2025-03-10', latest: '2026-08-22' };
    const period = { year: 2026, month: 6, dayFrom: 1, dayTo: 11 };
    expect(resolveDefaultChartWeekSelection(2026, bounds, period)).toEqual({
      year: 2026,
      month: 8,
      weekStartDate: '2026-08-17',
      weekEndDate: '2026-08-23',
    });
  });

  it('resolveDefaultChartWeekSelection picks first week for past year', () => {
    const bounds = { earliest: '2025-03-10', latest: '2026-08-22' };
    const period = { year: 2026, month: 6, dayFrom: 1, dayTo: 11 };
    expect(resolveDefaultChartWeekSelection(2025, bounds, period)).toEqual({
      year: 2025,
      month: 3,
      weekStartDate: '2025-03-10',
      weekEndDate: '2025-03-16',
    });
  });

  it('resolveDefaultWeekForMonth uses first week for non-latest month in current year', () => {
    const bounds = { earliest: '2025-03-10', latest: '2026-08-22' };
    const period = { year: 2026, month: 6, dayFrom: 1, dayTo: 11 };
    expect(resolveDefaultWeekForMonth(2026, 5, bounds, period)).toEqual({
      startDate: '2026-04-27',
      endDate: '2026-05-03',
    });
  });

  it('resolveLatestChartPeriodSelection returns latest month and week', () => {
    const bounds = { earliest: '2025-03-10', latest: '2026-08-22' };
    const period = { year: 2026, month: 6, dayFrom: 1, dayTo: 11 };

    expect(resolveLatestChartPeriodSelection('year', bounds, period)).toEqual({
      year: 2026,
      month: 1,
    });
    expect(resolveLatestChartPeriodSelection('month', bounds, period)).toEqual({
      year: 2026,
      month: 8,
    });
    expect(resolveLatestChartPeriodSelection('week', bounds, period)).toEqual({
      year: 2026,
      month: 8,
      weekStartDate: '2026-08-17',
      weekEndDate: '2026-08-23',
    });
  });

  it('isChartPeriodResetVisible hides reset for latest and null selections', () => {
    const bounds = { earliest: '2025-03-10', latest: '2026-08-22' };
    const period = { year: 2026, month: 6, dayFrom: 1, dayTo: 11 };
    const latestMonth = { year: 2026, month: 8 };

    expect(isChartPeriodResetVisible(null, 'month', bounds, period)).toBe(false);
    expect(isChartPeriodResetVisible(latestMonth, 'month', bounds, period)).toBe(false);
    expect(isChartPeriodResetVisible({ year: 2026, month: 5 }, 'month', bounds, period)).toBe(true);
  });

  it('chartPeriodSelectionsEqual compares week ISO ranges', () => {
    const left = {
      year: 2026,
      month: 8,
      weekStartDate: '2026-08-17',
      weekEndDate: '2026-08-23',
    };
    const right = { ...left };
    expect(chartPeriodSelectionsEqual(left, right, 'week')).toBe(true);
    expect(
      chartPeriodSelectionsEqual(left, { ...right, weekEndDate: '2026-08-22' }, 'week'),
    ).toBe(false);
  });

  it('clampChartMonthInYear respects data bounds', () => {
    expect(clampChartMonthInYear(2025, 1, bounds)).toBe(3);
    expect(clampChartMonthInYear(2026, 12, bounds)).toBe(8);
    expect(clampChartMonthInYear(2026, 5, bounds)).toBe(5);
  });

  it('weekIndexInMonth returns 1-based ordinal within month', () => {
    expect(
      weekIndexInMonth(2026, 6, null, {
        startDate: '2026-06-08',
        endDate: '2026-06-14',
      }),
    ).toBe(2);
    expect(
      weekIndexInMonth(2026, 6, null, {
        startDate: '2026-06-29',
        endDate: '2026-07-05',
      }),
    ).toBe(5);
  });

  it('resolveWeekByIndexInMonth clamps to nearest available week', () => {
    expect(resolveWeekByIndexInMonth(2026, 2, null, 5)).toEqual({
      month: 2,
      startDate: '2026-02-23',
      endDate: '2026-03-01',
    });
  });

  it('chartPeriodSelectionForMonthDay builds full ISO week', () => {
    expect(chartPeriodSelectionForMonthDay(2026, 5, 4, bounds)).toEqual({
      year: 2026,
      month: 5,
      weekStartDate: '2026-05-04',
      weekEndDate: '2026-05-10',
    });
  });
});
