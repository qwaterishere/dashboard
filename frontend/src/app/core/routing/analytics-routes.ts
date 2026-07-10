/** Сегменты аналитических страниц с кэшем компонентов и TTL-данных. */
export const ANALYTICS_ROUTE_SEGMENTS = [
  'dashboard',
  'sales',
  'warehouse',
  'foodcost',
] as const;

export type AnalyticsRouteSegment = (typeof ANALYTICS_ROUTE_SEGMENTS)[number];

export function isAnalyticsRoute(segment: string): segment is AnalyticsRouteSegment {
  return (ANALYTICS_ROUTE_SEGMENTS as readonly string[]).includes(segment);
}

export function isCachedRoutePath(path: string | undefined): path is AnalyticsRouteSegment {
  return !!path && isAnalyticsRoute(path);
}

/** Страницы API, которые нужно освежить при активном маршруте. */
export function pagesToSyncForRoute(
  segment: AnalyticsRouteSegment,
): readonly AnalyticsRouteSegment[] {
  return segment === 'dashboard' ? ['dashboard', 'warehouse'] : [segment];
}
