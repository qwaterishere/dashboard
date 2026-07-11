import { DestroyRef, effect, inject, Injectable, Injector, runInInjectionContext, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, startWith } from 'rxjs';

import type { PageName } from '../../shared/models';
import { ANALYTICS_CACHE_CONFIG } from '../config/analytics-cache.config';
import { readPrimaryNavSegment } from '../routing/nav-active.service';
import {
  isAnalyticsRoute,
  pagesToSyncForRoute,
  type AnalyticsRouteSegment,
} from '../routing/analytics-routes';

type RegisteredResource = {
  page: PageName;
  resource: {
    hasValue(): boolean;
    reload(): unknown;
  };
};

/**
 * TTL + stale-while-revalidate для root httpResource-ов аналитики.
 * Пока пользователь на analytics-странице — фоновый poll; при возврате на вкладку
 * устаревшие данные перезагружаются через `reload()` без сброса кэша.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsDataSyncService {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly config = inject(ANALYTICS_CACHE_CONFIG);

  private readonly registered = new Map<PageName, RegisteredResource>();
  private readonly lastFetchedAt = new Map<PageName, number>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  register(page: PageName, resource: RegisteredResource['resource']): void {
    if (this.registered.has(page)) return;

    this.registered.set(page, { page, resource });

    runInInjectionContext(this.injector, () => {
      effect(() => {
        if (resource.hasValue()) {
          untracked(() => this.markFresh(page));
        }
      });
    });
  }

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        startWith(null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.onNavigation());

    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  markFresh(page: PageName, at = Date.now()): void {
    this.lastFetchedAt.set(page, at);
  }

  isStale(page: PageName, now = Date.now()): boolean {
    const last = this.lastFetchedAt.get(page);
    if (last === undefined) return true;
    return now - last >= this.config.staleAfterMs;
  }

  private onNavigation(): void {
    const segment = readPrimaryNavSegment(this.router.url);
    if (!isAnalyticsRoute(segment)) {
      this.stopPolling();
      return;
    }

    this.refreshStaleForRoute(segment);
    this.startPolling();
  }

  private startPolling(): void {
    if (this.pollTimer !== null) return;

    this.pollTimer = setInterval(
      () => {
        const segment = readPrimaryNavSegment(this.router.url);
        if (!isAnalyticsRoute(segment)) return;
        this.refreshStaleForRoute(segment);
      },
      this.config.pollIntervalMs,
    );
  }

  private stopPolling(): void {
    if (this.pollTimer === null) return;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private refreshStaleForRoute(segment: AnalyticsRouteSegment): void {
    const now = Date.now();

    for (const page of pagesToSyncForRoute(segment)) {
      const entry = this.registered.get(page);
      if (!entry || !entry.resource.hasValue()) continue;

      const last = this.lastFetchedAt.get(page);
      if (last !== undefined && now - last < this.config.staleAfterMs) continue;

      entry.resource.reload();
    }
  }
}
