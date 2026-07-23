import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { routes } from '../../../app.routes';
import { provideMockAuthenticatedAuth } from '../../../core/auth/auth.testing';
import { DataFreshnessService } from '../../../core/data/data-freshness.service';
import type { DataFreshness } from '../../../shared/models/data-freshness.model';
import { PeriodService } from '../../../core/services/period.service';
import { TargetsDataStore } from './targets-data.store';
import { TargetsPeriodService } from './targets-period.service';

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

const emptyTargetsBody = (year: number, month: number, label: string, refLabel: string) => ({
  period: { year, month, label },
  reference: { label: refLabel, revenueFact: 0, revenuePace: 0 },
  revenue: { monthPlan: 0, weekProfile: [1, 1, 1, 1, 1, 1, 1] },
  dailyOverrides: {},
  foodcost: [],
  writeoffs: [],
  compliments: { mode: 'pct', goalPct: 0, goalRub: 0, factPct: 0, factRub: 0 },
  inventory: { mode: 'pct', goalPct: 0, goalRub: 0, note: '' },
  locked: false,
});

describe('TargetsDataStore', () => {
  let store: TargetsDataStore;
  let http: HttpTestingController;
  let targetsPeriod: TargetsPeriodService;
  let dashboardPeriod: PeriodService;
  let freshnessSignal: ReturnType<typeof signal<DataFreshness | null>>;

  function flushConfigured(
    items: { year: number; month: number; label: string }[] = [],
  ): void {
    const req = http.expectOne((r) => r.url.includes('/targets/configured'));
    expect(req.request.method).toBe('GET');
    req.flush({ items });
  }

  function flushTargets(year: number, month: number, label: string, refLabel: string): void {
    const req = http.expectOne(
      (r) =>
        r.url.includes('/targets') &&
        !r.url.includes('/configured') &&
        r.params.get('year') === String(year) &&
        r.params.get('month') === String(month),
    );
    expect(req.request.method).toBe('GET');
    req.flush(emptyTargetsBody(year, month, label, refLabel));
  }

  beforeEach(async () => {
    sessionStorage.removeItem('sezony-targets-period');
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

    targetsPeriod = TestBed.inject(TargetsPeriodService);
    dashboardPeriod = TestBed.inject(PeriodService);
    store = TestBed.inject(TargetsDataStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.removeItem('sezony-targets-period');
    TestBed.resetTestingModule();
  });

  it('fetches targets with year/month from TargetsPeriodService', () => {
    targetsPeriod.setMonth(2026, 8);
    TestBed.flushEffects();

    flushConfigured();
    flushTargets(2026, 8, 'Август 2026', 'июля');
  });

  it('loads configured month keys for picker highlight', async () => {
    targetsPeriod.setMonth(2026, 5);
    TestBed.flushEffects();

    flushConfigured([
      { year: 2026, month: 3, label: 'Март 2026' },
      { year: 2026, month: 5, label: 'Май 2026' },
    ]);
    flushTargets(2026, 5, 'Май 2026', 'апреля');
    await Promise.resolve();

    expect(store.isMonthConfigured(2026, 3)).toBe(true);
    expect(store.isMonthConfigured(2026, 5)).toBe(true);
    expect(store.isMonthConfigured(2026, 4)).toBe(false);
  });

  it('does not follow dashboard PeriodService granularity changes', () => {
    targetsPeriod.setMonth(2026, 5);
    TestBed.flushEffects();

    flushConfigured();
    flushTargets(2026, 5, 'Май 2026', 'апреля');

    dashboardPeriod.granularity.set('year');
    dashboardPeriod.dashboardPeriod.set({ year: 2026, month: 1, dayFrom: 1, dayTo: 31 });
    TestBed.flushEffects();

    http.expectNone(
      (r) =>
        r.url.includes('/targets') &&
        !r.url.includes('/configured') &&
        r.params.get('month') === '1',
    );
  });

  it('bootstraps month from freshness then queries API', () => {
    freshnessSignal.set(freshness({ latestSalesDay: '2026-06-10' }));
    TestBed.flushEffects();

    expect(targetsPeriod.selection()).toEqual({ year: 2026, month: 6 });

    flushConfigured();
    flushTargets(2026, 6, 'Июнь 2026', 'мая');
  });
});
