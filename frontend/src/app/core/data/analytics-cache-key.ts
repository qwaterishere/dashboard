import type { ChartPeriodSelection } from '../../shared/models/chart-period.model';
import type { PeriodGranularity } from '../../shared/models/common.model';

export interface DashboardQueryKey {
  year?: number;
  month?: number;
}

/** Scope tenant-кэша: user.id (1 user = 1 restaurant на MVP). */
export function analyticsTenantScope(userId: string | null | undefined): string {
  return userId ?? 'anonymous';
}

export function buildDashboardCacheKey(
  tenantScope: string,
  query: DashboardQueryKey,
): string {
  if (query.year != null && query.month != null) {
    return `${tenantScope}:m:${query.year}-${query.month}`;
  }
  if (query.year != null) {
    return `${tenantScope}:y:${query.year}`;
  }
  return `${tenantScope}:latest`;
}

export function chartSelectionToQuery(
  selection: ChartPeriodSelection,
  granularity: PeriodGranularity,
): DashboardQueryKey {
  if (granularity === 'year') {
    return { year: selection.year };
  }
  return { year: selection.year, month: selection.month };
}

export function tenantScopeFromCacheKey(key: string): string {
  const idx = key.indexOf(':');
  return idx === -1 ? key : key.slice(0, idx);
}
