import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { routes } from '../../../app.routes';
import { provideMockAuthenticatedAuth } from '../../../core/auth/auth.testing';
import { DataFreshnessService } from '../../../core/data/data-freshness.service';
import type { DataFreshness } from '../../../shared/models/data-freshness.model';
import { SalesDataStore } from './sales-data.store';
import { SalesPeriodService } from './sales-period.service';

function freshness(partial: Partial<DataFreshness> = {}): DataFreshness {
  return {
    status: 'fresh',
    expectedDay: '2026-06-10',
    latestSalesDay: '2026-06-10',
    lagDays: 0,
    lastSyncAt: null,
    syncStatus: 'idle',
    syncError: null,
    autoSyncEnabled: false,
    syncProgressPercent: null,
    ...partial,
  };
}

describe('SalesDataStore', () => {
  let store: SalesDataStore;
  let http: HttpTestingController;
  let period: SalesPeriodService;
  let freshnessSignal: ReturnType<typeof signal<DataFreshness | null>>;
  let router: Router;

  beforeEach(async () => {
    sessionStorage.removeItem('sezony-sales-period');
    freshnessSignal = signal<DataFreshness | null>(null);

    await TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockAuthenticatedAuth(),
        {
          provide: DataFreshnessService,
          useValue: {
            freshness: freshnessSignal,
            loading: signal(false),
            loadError: signal(false),
            refresh: () => undefined,
          },
        },
      ],
    }).compileComponents();

    period = TestBed.inject(SalesPeriodService);
    store = TestBed.inject(SalesDataStore);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.removeItem('sezony-sales-period');
    TestBed.resetTestingModule();
  });

  it('exposes empty positions before data loads', () => {
    expect(store.positions()).toEqual([]);
  });

  it('always requests sales with date_from and date_to from SalesPeriodService', () => {
    period.setPreset('week', '2026-06-10');
    TestBed.flushEffects();

    const req = http.expectOne(
      (r) =>
        r.url.includes('/sales') &&
        r.url.includes('date_from=2026-06-08') &&
        r.url.includes('date_to=2026-06-14'),
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      period: { dateFrom: '2026-06-08', dateTo: '2026-06-14', label: '', note: '' },
      positions: [],
    });
  });

  it('bootstraps month range from freshness and queries API', () => {
    freshnessSignal.set(freshness({ latestSalesDay: '2026-06-10' }));
    TestBed.flushEffects();

    expect(period.range()).toEqual({ dateFrom: '2026-06-01', dateTo: '2026-06-10' });

    const req = http.expectOne(
      (r) =>
        r.url.includes('/sales') &&
        r.url.includes('date_from=2026-06-01') &&
        r.url.includes('date_to=2026-06-10'),
    );
    req.flush({
      period: { dateFrom: '2026-06-01', dateTo: '2026-06-10', label: '', note: '' },
      positions: [],
    });
  });

  it('syncs truncated API period back into SalesPeriodService', async () => {
    period.setPreset('month', '2026-06-30');
    TestBed.flushEffects();

    const req = http.expectOne((r) => r.url.includes('/sales'));
    req.flush({
      period: { dateFrom: '2026-06-01', dateTo: '2026-06-16', label: '', note: '' },
      positions: [],
    });
    await Promise.resolve();
    TestBed.flushEffects();

    expect(period.range()).toEqual({ dateFrom: '2026-06-01', dateTo: '2026-06-16' });

    const followUp = http.expectOne(
      (r) =>
        r.url.includes('/sales') &&
        r.url.includes('date_from=2026-06-01') &&
        r.url.includes('date_to=2026-06-16'),
    );
    followUp.flush({
      period: { dateFrom: '2026-06-01', dateTo: '2026-06-16', label: '', note: '' },
      positions: [],
    });
  });

  it('seeds range from router query then clears query', async () => {
    await router.navigateByUrl('/sales?date_from=2026-06-01&date_to=2026-06-03');
    TestBed.flushEffects();

    expect(period.preset()).toBe('custom');
    expect(period.range()).toEqual({ dateFrom: '2026-06-01', dateTo: '2026-06-03' });

    const req = http.expectOne(
      (r) =>
        r.url.includes('/sales') &&
        r.url.includes('date_from=2026-06-01') &&
        r.url.includes('date_to=2026-06-03'),
    );
    req.flush({
      period: { dateFrom: '2026-06-01', dateTo: '2026-06-03', label: '', note: '' },
      positions: [],
    });
  });
});
