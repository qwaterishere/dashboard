import { TestBed } from '@angular/core/testing';

import { provideMockAuthenticatedAuth } from '../../../core/auth/auth.testing';
import { AuthService } from '../../../core/auth/auth.service';
import { filterRevenueDays } from '../../../shared/utils/period-format.utils';
import type { RevenueDayFact } from '../../../shared/models/dashboard-api.model';
import { PeriodService } from '../../../core/services/period.service';
import { DashboardDataStore } from './dashboard-data.store';

describe('DashboardDataStore', () => {
  it('defaults granularity to month via PeriodService', () => {
    const store = TestBed.inject(DashboardDataStore);
    expect(store.granularity()).toBe('month');
  });

  it('starts with loading period label', () => {
    const store = TestBed.inject(DashboardDataStore);
    expect(store.period().label).toBe('…');
  });
});

describe('DashboardDataStore logout reset', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [provideMockAuthenticatedAuth()],
    }).compileComponents();
  });

  it('resets PeriodService when auth session clears', () => {
    const auth = TestBed.inject(AuthService);
    const period = TestBed.inject(PeriodService);
    const store = TestBed.inject(DashboardDataStore);

    period.dashboardPeriod.set({ year: 2026, month: 6, dayFrom: 1, dayTo: 11 });
    period.chartDataBounds.set({ earliest: '2025-03-10', latest: '2026-08-22' });
    period.applyChartPeriod({ year: 2026, month: 5 });
    period.granularity.set('week');
    period.chartDisplayMode.set('quarter');

    auth.clearSession();
    TestBed.flushEffects();

    expect(period.granularity()).toBe('month');
    expect(period.chartDisplayMode()).toBe('day');
    expect(period.chartPeriod()).toBeNull();
    expect(period.dashboardPeriod()).toBeNull();
    expect(period.chartDataBounds()).toBeNull();
    expect(store.period().label).toBe('…');
  });
});

describe('filterRevenueDays', () => {
  const period = { year: 2026, month: 6, dayFrom: 1, dayTo: 11 };
  const days: RevenueDayFact[] = Array.from({ length: 11 }, (_, i) => ({
    day: i + 1,
    weekday: 1,
    revenue: 0,
    checks: 0,
    guests: 0,
    plan: null,
  }));

  it('keeps calendar week for week granularity', () => {
    expect(filterRevenueDays(days, period, 'week')).toHaveLength(7);
    expect(filterRevenueDays(days, period, 'week').map((d) => d.day)).toEqual([
      8, 9, 10, 11, 12, 13, 14,
    ]);
  });
});

describe('PeriodService integration', () => {
  it('shares granularity between store and period service', () => {
    const store = TestBed.inject(DashboardDataStore);
    const period = TestBed.inject(PeriodService);
    store.granularity.set('week');
    expect(period.granularity()).toBe('week');
  });
});
