import {
  analyticsTenantScope,
  buildDashboardCacheKey,
  chartSelectionToQuery,
  tenantScopeFromCacheKey,
} from './analytics-cache-key';
import type { ChartPeriodSelection } from '../../shared/models/chart-period.model';

describe('analytics-cache-key', () => {
  const tenant = analyticsTenantScope('user-1');

  it('builds latest, month and year keys with tenant scope', () => {
    expect(buildDashboardCacheKey(tenant, {})).toBe('user-1:latest');
    expect(buildDashboardCacheKey(tenant, { year: 2026, month: 6 })).toBe('user-1:m:2026-6');
    expect(buildDashboardCacheKey(tenant, { year: 2025 })).toBe('user-1:y:2025');
  });

  it('maps chart selection to query by granularity', () => {
    const selection: ChartPeriodSelection = { year: 2026, month: 5 };
    expect(chartSelectionToQuery(selection, 'month')).toEqual({ year: 2026, month: 5 });
    expect(chartSelectionToQuery(selection, 'week')).toEqual({ year: 2026, month: 5 });
    expect(chartSelectionToQuery(selection, 'year')).toEqual({ year: 2026 });
  });

  it('extracts tenant scope from cache key', () => {
    expect(tenantScopeFromCacheKey('user-1:m:2026-6')).toBe('user-1');
  });
});
