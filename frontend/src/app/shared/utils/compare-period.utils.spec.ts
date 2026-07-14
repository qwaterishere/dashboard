import {
  apiPeriodToCompareSelection,
  buildChartDataframeContext,
  compareSelectionToApiPeriod,
  compareSelectionToDateRange,
  formatDataframePeriodLabel,
  isCompareSelectionSameAsDataframe,
  isDataframeMonth,
  isDataframeWeek,
  resolveCompareActivePeriod,
} from './compare-period.utils';

describe('compare-period.utils', () => {
  const primaryMtd = { year: 2026, month: 6, dayFrom: 1, dayTo: 11 };
  const primaryFull = { year: 2026, month: 6, dayFrom: 1, dayTo: 30 };

  it('maps month MTD selection to compare date range', () => {
    expect(
      compareSelectionToDateRange({ year: 2026, month: 5 }, 'month', primaryMtd),
    ).toEqual({
      compareStart: '2026-05-01',
      compareEnd: '2026-05-11',
    });
  });

  it('maps full month selection to full compare month', () => {
    expect(
      compareSelectionToDateRange({ year: 2026, month: 5 }, 'month', primaryFull),
    ).toEqual({
      compareStart: '2026-05-01',
      compareEnd: '2026-05-31',
    });
  });

  it('maps week selection to ISO week range', () => {
    expect(
      compareSelectionToDateRange(
        {
          year: 2026,
          month: 5,
          weekStartDate: '2026-05-04',
          weekEndDate: '2026-05-10',
        },
        'week',
        primaryMtd,
      ),
    ).toEqual({
      compareStart: '2026-05-04',
      compareEnd: '2026-05-10',
    });
  });

  it('falls back month-shaped selection in week mode without throwing', () => {
    expect(
      compareSelectionToDateRange({ year: 2026, month: 5 }, 'week', primaryMtd),
    ).toEqual({
      compareStart: '2026-05-01',
      compareEnd: '2026-05-11',
    });
  });

  it('round-trips selection to api period for display', () => {
    const selection = { year: 2026, month: 5 };
    expect(compareSelectionToApiPeriod(selection, 'month', primaryMtd)).toEqual({
      year: 2026,
      month: 5,
      dayFrom: 1,
      dayTo: 11,
    });
  });

  it('uses weekKpi prev range for active compare period in week mode', () => {
    expect(
      resolveCompareActivePeriod(
        { year: 2026, month: 6, dayFrom: 8, dayTo: 14 },
        'week',
        {
          prevWeekStart: '2026-06-01',
          prevWeekEnd: '2026-06-07',
        } as import('../models/dashboard-api.model').WeekKpiContext,
      ),
    ).toEqual({
      year: 2026,
      month: 6,
      dayFrom: 1,
      dayTo: 7,
    });
  });

  it('maps api period to compare selection', () => {
    expect(
      apiPeriodToCompareSelection({ year: 2026, month: 5, dayFrom: 1, dayTo: 11 }, 'month'),
    ).toEqual({ year: 2026, month: 5 });
  });

  it('detects dataframe month and week overlap', () => {
    expect(isDataframeMonth(2026, 6, { year: 2026, month: 6, dayFrom: 1, dayTo: 11 })).toBe(true);
    expect(isDataframeMonth(2026, 5, { year: 2026, month: 6, dayFrom: 1, dayTo: 11 })).toBe(false);
    expect(
      isDataframeWeek(
        { startDate: '2026-06-08', endDate: '2026-06-14' },
        { startDate: '2026-06-08', endDate: '2026-06-14' },
      ),
    ).toBe(true);
    expect(
      isCompareSelectionSameAsDataframe(
        { year: 2026, month: 6 },
        'month',
        { period: { year: 2026, month: 6, dayFrom: 1, dayTo: 11 } },
      ),
    ).toBe(true);
  });

  it('formats dataframe period label', () => {
    expect(
      formatDataframePeriodLabel(
        {
          period: { year: 2026, month: 6, dayFrom: 1, dayTo: 11 },
        },
        'month',
      ),
    ).toContain('2026');
  });

  it('detects compare selection collision with dataframe context', () => {
    const dataframe = buildChartDataframeContext(
      { year: 2026, month: 6 },
      'month',
      { year: 2026, month: 6, dayFrom: 1, dayTo: 11 },
    );
    expect(
      isCompareSelectionSameAsDataframe({ year: 2026, month: 6 }, 'month', dataframe),
    ).toBe(true);
    expect(
      isCompareSelectionSameAsDataframe({ year: 2026, month: 5 }, 'month', dataframe),
    ).toBe(false);
  });
});
