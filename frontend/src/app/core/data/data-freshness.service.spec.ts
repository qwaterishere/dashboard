import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthService } from '../auth/auth.service';
import { ANALYTICS_CACHE_CONFIG } from '../config/analytics-cache.config';
import { API_CONFIG } from '../config/api-config.token';
import { DataFreshnessService } from './data-freshness.service';
import type { DataFreshness } from '../../shared/models/data-freshness.model';

function freshness(partial: Partial<DataFreshness> = {}): DataFreshness {
  return {
    status: 'fresh',
    expectedDay: '2026-03-04',
    latestSalesDay: '2026-03-04',
    lagDays: 0,
    lastSyncAt: null,
    syncStatus: 'idle',
    syncError: null,
    autoSyncEnabled: true,
    syncProgressPercent: null,
    ...partial,
  };
}

describe('DataFreshnessService sync lifecycle', () => {
  let service: DataFreshnessService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_CONFIG, useValue: { apiBase: '/api' } },
        {
          provide: ANALYTICS_CACHE_CONFIG,
          useValue: { staleAfterMs: 60_000, pollIntervalMs: 45_000 },
        },
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: signal(true),
            user: signal({ id: 'u1' }),
          },
        },
        DataFreshnessService,
      ],
    });

    service = TestBed.inject(DataFreshnessService);
    http = TestBed.inject(HttpTestingController);
    TestBed.flushEffects();

    const initial = http.match('/api/data-freshness');
    expect(initial.length).toBeGreaterThan(0);
    initial.forEach((req) =>
      req.flush(freshness({ status: 'stale', lagDays: 1, latestSalesDay: '2026-03-03' })),
    );
  });

  afterEach(() => {
    http.verify();
  });

  it('updates badge immediately after noteSyncFinished', () => {
    service.noteSyncFinished();

    const req = http.expectOne('/api/data-freshness');
    req.flush(freshness({ status: 'fresh', lagDays: 0, latestSalesDay: '2026-03-04' }));

    expect(service.freshness()?.status).toBe('fresh');
    expect(service.freshness()?.lagDays).toBe(0);
  });

  it('refreshes on noteSyncStarted', () => {
    service.noteSyncStarted();

    const req = http.expectOne('/api/data-freshness');
    req.flush(
      freshness({
        status: 'syncing',
        syncStatus: 'running',
        lagDays: 1,
        syncProgressPercent: 20,
      }),
    );

    expect(service.freshness()?.status).toBe('syncing');
    expect(service.freshness()?.syncProgressPercent).toBe(20);
  });

  it('refreshes on noteSettingsChanged', () => {
    service.noteSettingsChanged();

    http
      .expectOne('/api/data-freshness')
      .flush(freshness({ status: 'empty', lagDays: null, latestSalesDay: null }));

    expect(service.freshness()?.status).toBe('empty');
  });
});
