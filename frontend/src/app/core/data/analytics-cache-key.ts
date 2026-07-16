import type { ChartPeriodSelection } from '../../shared/models/chart-period.model';
import type { PeriodGranularity } from '../../shared/models/common.model';

/** Bump when меняется контракт chart/kpi/compare — сбрасывает in-memory кэш дашборда. */
export const DASHBOARD_CACHE_SCHEMA = 'v10';

export interface DashboardQueryKey {
  year?: number;
  month?: number;
  weekStart?: string;
  weekEnd?: string;
  compareStart?: string;
  compareEnd?: string;
}

/** Scope tenant-кэша: user.id (1 user = 1 restaurant на MVP). */
export function analyticsTenantScope(userId: string | null | undefined): string {
  return userId ?? 'anonymous';
}

function appendCompareSuffix(key: string, query: DashboardQueryKey): string {
  if (query.compareStart && query.compareEnd) {
    return `${key}:c:${query.compareStart}:${query.compareEnd}`;
  }
  return key;
}

export function buildDashboardCacheKey(
  tenantScope: string,
  query: DashboardQueryKey,
): string {
  const prefix = `${tenantScope}:${DASHBOARD_CACHE_SCHEMA}`;
  if (query.year != null && query.month != null) {
    const base = `${prefix}:m:${query.year}-${query.month}`;
    if (query.weekStart && query.weekEnd) {
      return appendCompareSuffix(`${base}:w:${query.weekStart}:${query.weekEnd}`, query);
    }
    return appendCompareSuffix(base, query);
  }
  if (query.year != null) {
    return appendCompareSuffix(`${prefix}:y:${query.year}`, query);
  }
  return appendCompareSuffix(`${prefix}:latest`, query);
}

export function mergeDashboardQueryWithCompare(
  query: DashboardQueryKey,
  compare: { compareStart: string; compareEnd: string } | null,
): DashboardQueryKey {
  if (!compare) return query;
  return { ...query, compareStart: compare.compareStart, compareEnd: compare.compareEnd };
}

export function chartSelectionToQuery(
  selection: ChartPeriodSelection,
  granularity: PeriodGranularity,
): DashboardQueryKey {
  if (granularity === 'year') {
    return { year: selection.year };
  }
  if (
    granularity === 'week' &&
    selection.weekStartDate &&
    selection.weekEndDate
  ) {
    return {
      year: selection.year,
      month: selection.month,
      weekStart: selection.weekStartDate,
      weekEnd: selection.weekEndDate,
    };
  }
  return { year: selection.year, month: selection.month };
}

export function tenantScopeFromCacheKey(key: string): string {
  const idx = key.indexOf(':');
  return idx === -1 ? key : key.slice(0, idx);
}

/** Inverse of buildDashboardCacheKey — для загрузки по ключу кэша. */
export function parseDashboardCacheKey(key: string): DashboardQueryKey {
  const segments = key.split(':');
  const compareIdx = segments.indexOf('c');
  let compareStart: string | undefined;
  let compareEnd: string | undefined;
  if (compareIdx !== -1) {
    compareStart = segments[compareIdx + 1];
    compareEnd = segments[compareIdx + 2];
  }

  const primary = compareIdx === -1 ? segments : segments.slice(0, compareIdx);
  let idx = 1;
  if (/^v\d+$/.test(primary[idx] ?? '')) {
    idx += 1;
  }

  const baseQuery = (): DashboardQueryKey => ({ compareStart, compareEnd });

  if (primary[idx] === 'latest') {
    return baseQuery();
  }

  const weekIdx = primary.indexOf('w');
  if (weekIdx !== -1) {
    const [year, month] = primary[weekIdx - 1]?.split('-').map(Number) ?? [];
    return {
      year,
      month,
      weekStart: primary[weekIdx + 1],
      weekEnd: primary[weekIdx + 2],
      compareStart,
      compareEnd,
    };
  }

  const kind = primary[idx];
  const value = primary[idx + 1] ?? '';

  if (kind === 'm') {
    const [year, month] = value.split('-').map(Number);
    return { year, month, compareStart, compareEnd };
  }
  if (kind === 'y') {
    return { year: Number(value), compareStart, compareEnd };
  }
  return baseQuery();
}
