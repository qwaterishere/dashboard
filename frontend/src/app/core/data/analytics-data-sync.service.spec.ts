import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { HttpResourceRef } from '@angular/common/http';

import { routes } from '../../app.routes';
import { provideMockAuthenticatedAuth } from '../auth/auth.testing';
import { ANALYTICS_CACHE_CONFIG } from '../config/analytics-cache.config';
import { AnalyticsDataSyncService } from './analytics-data-sync.service';

function mockResource(hasValue: boolean): HttpResourceRef<unknown> {
  const value = signal(hasValue ? { ok: true } : undefined);
  return {
    hasValue: () => hasValue,
    value: () => value(),
    reload: vi.fn(() => true),
  } as unknown as HttpResourceRef<unknown>;
}

describe('AnalyticsDataSyncService', () => {
  let service: AnalyticsDataSyncService;
  let router: Router;

  beforeEach(async () => {
    vi.useFakeTimers();

    await TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideMockAuthenticatedAuth(),
        {
          provide: ANALYTICS_CACHE_CONFIG,
          useValue: { staleAfterMs: 1_000, pollIntervalMs: 500 },
        },
      ],
    }).compileComponents();

    service = TestBed.inject(AnalyticsDataSyncService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks resource fresh and detects staleness', () => {
    service.markFresh('dashboard', 1_000);
    expect(service.isStale('dashboard', 1_500)).toBe(false);
    expect(service.isStale('dashboard', 2_100)).toBe(true);
  });

  it('reloads stale data when returning to analytics route', async () => {
    const resource = mockResource(true);
    service.register('sales', resource);
    service.markFresh('sales', Date.now() - 5_000);

    await router.navigateByUrl('/sales');
    expect(resource.reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload fresh data on quick tab switch', async () => {
    const resource = mockResource(true);
    service.register('warehouse', resource);
    service.markFresh('warehouse');

    await router.navigateByUrl('/warehouse');
    expect(resource.reload).not.toHaveBeenCalled();

    await router.navigateByUrl('/settings');
    await router.navigateByUrl('/warehouse');
    expect(resource.reload).not.toHaveBeenCalled();
  });
});
