import {
  analyticsTenantScope,
  buildDashboardCacheKey,
  chartSelectionToQuery,
  mergeDashboardQueryWithCompare,
  parseDashboardCacheKey,
  tenantScopeFromCacheKey,
} from './analytics-cache-key';
import type { ChartPeriodSelection } from '../../shared/models/chart-period.model';

describe('analytics-cache-key', () => {
  const tenant = analyticsTenantScope('user-1');

  it('builds latest, month and year keys with tenant scope', () => {
    expect(buildDashboardCacheKey(tenant, {})).toBe('user-1:v8:latest');
    expect(buildDashboardCacheKey(tenant, { year: 2026, month: 6 })).toBe('user-1:v8:m:2026-6');
    expect(buildDashboardCacheKey(tenant, { year: 2025 })).toBe('user-1:v8:y:2025');
  });

  it('builds week overlay keys', () => {
    expect(
      buildDashboardCacheKey(tenant, {
        year: 2026,
        month: 6,
        weekStart: '2026-06-08',
        weekEnd: '2026-06-14',
      }),
    ).toBe('user-1:v8:m:2026-6:w:2026-06-08:2026-06-14');
  });

  it('appends compare suffix when compare range is set', () => {
    expect(
      buildDashboardCacheKey(tenant, {
        compareStart: '2026-05-01',
        compareEnd: '2026-05-11',
      }),
    ).toBe('user-1:v8:latest:c:2026-05-01:2026-05-11');

    expect(
      buildDashboardCacheKey(tenant, {
        year: 2026,
        month: 6,
        compareStart: '2026-05-01',
        compareEnd: '2026-05-31',
      }),
    ).toBe('user-1:v8:m:2026-6:c:2026-05-01:2026-05-31');
  });

  it('merges compare range into query', () => {
    expect(
      mergeDashboardQueryWithCompare({ year: 2026, month: 6 }, {
        compareStart: '2026-05-01',
        compareEnd: '2026-05-11',
      }),
    ).toEqual({
      year: 2026,
      month: 6,
      compareStart: '2026-05-01',
      compareEnd: '2026-05-11',
    });
  });

  it('maps chart selection to query by granularity', () => {
    const selection: ChartPeriodSelection = { year: 2026, month: 5 };
    expect(chartSelectionToQuery(selection, 'month')).toEqual({ year: 2026, month: 5 });
    expect(chartSelectionToQuery(selection, 'week')).toEqual({ year: 2026, month: 5 });
    expect(chartSelectionToQuery(selection, 'year')).toEqual({ year: 2026 });

    const weekSelection: ChartPeriodSelection = {
      year: 2026,
      month: 6,
      weekStartDate: '2026-06-08',
      weekEndDate: '2026-06-14',
    };
    expect(chartSelectionToQuery(weekSelection, 'week')).toEqual({
      year: 2026,
      month: 6,
      weekStart: '2026-06-08',
      weekEnd: '2026-06-14',
    });
  });

  it('extracts tenant scope from cache key', () => {
    expect(tenantScopeFromCacheKey('user-1:v8:m:2026-6')).toBe('user-1');
  });

  it('round-trips cache keys via parseDashboardCacheKey', () => {
    const monthKey = buildDashboardCacheKey(tenant, { year: 2026, month: 6 });
    expect(parseDashboardCacheKey(monthKey)).toEqual({ year: 2026, month: 6 });

    const compareKey = buildDashboardCacheKey(tenant, {
      year: 2026,
      month: 6,
      weekStart: '2026-06-08',
      weekEnd: '2026-06-14',
      compareStart: '2026-05-01',
      compareEnd: '2026-05-07',
    });
    expect(parseDashboardCacheKey(compareKey)).toEqual({
      year: 2026,
      month: 6,
      weekStart: '2026-06-08',
      weekEnd: '2026-06-14',
      compareStart: '2026-05-01',
      compareEnd: '2026-05-07',
    });
  });
});
