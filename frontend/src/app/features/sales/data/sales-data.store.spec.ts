import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { routes } from '../../../app.routes';
import { provideMockAuthenticatedAuth } from '../../../core/auth/auth.testing';
import { PeriodService } from '../../../core/services/period.service';
import { SalesDataStore } from './sales-data.store';

describe('SalesDataStore', () => {
  let store: SalesDataStore;
  let router: Router;
  let period: PeriodService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideMockAuthenticatedAuth()],
    }).compileComponents();

    store = TestBed.inject(SalesDataStore);
    router = TestBed.inject(Router);
    period = TestBed.inject(PeriodService);
  });

  it('exposes empty positions before data loads', () => {
    expect(store.positions()).toEqual([]);
  });

  it('reacts to week granularity via PeriodService', () => {
    period.markGranularitySynced();
    period.dashboardPeriod.set({ year: 2026, month: 6, dayFrom: 1, dayTo: 11 });
    period.granularity.set('week');
    TestBed.flushEffects();
    expect(period.salesQuery()).toEqual({
      dateFrom: '2026-06-08',
      dateTo: '2026-06-14',
    });
  });

  it('reads day query from router url', async () => {
    await router.navigateByUrl('/sales?date_from=2026-06-01&date_to=2026-06-03');
    expect(store.data).toBeDefined();
  });
});
