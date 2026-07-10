import {
  ActivatedRouteSnapshot,
  DetachedRouteHandle,
  RouteReuseStrategy,
} from '@angular/router';
import { Injectable } from '@angular/core';

import { isCachedRoutePath } from './analytics-routes';

/**
 * Кэширует экземпляры analytics-страниц при переключении вкладок.
 * Settings / support / purchases пересоздаются как обычно.
 */
@Injectable()
export class AnalyticsRouteReuseStrategy implements RouteReuseStrategy {
  private readonly stored = new Map<string, DetachedRouteHandle>();

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return isCachedRoutePath(route.routeConfig?.path);
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle): void {
    const key = this.cacheKey(route);
    if (key) this.stored.set(key, handle);
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const key = this.cacheKey(route);
    return !!key && this.stored.has(key);
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const key = this.cacheKey(route);
    return key ? (this.stored.get(key) ?? null) : null;
  }

  shouldReuseRoute(
    future: ActivatedRouteSnapshot,
    curr: ActivatedRouteSnapshot,
  ): boolean {
    return future.routeConfig === curr.routeConfig;
  }

  private cacheKey(route: ActivatedRouteSnapshot): string | null {
    const path = route.routeConfig?.path;
    return isCachedRoutePath(path) ? path : null;
  }
}
