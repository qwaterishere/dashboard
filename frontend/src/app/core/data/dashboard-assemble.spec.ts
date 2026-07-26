import { describe, expect, it } from 'vitest';

import { resolveDashboardPeriod } from './dashboard-assemble';
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
