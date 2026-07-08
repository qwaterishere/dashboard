import { TestBed } from '@angular/core/testing';

import { filterRevenueDays } from '../../../shared/utils/period-format.utils';
import { DashboardDataStore } from './dashboard-data.store';

describe('DashboardDataStore', () => {
  it('defaults granularity to month', () => {
    const store = TestBed.inject(DashboardDataStore);
    expect(store.granularity()).toBe('month');
  });

  it('starts with loading period label', () => {
    const store = TestBed.inject(DashboardDataStore);
    expect(store.period().label).toBe('…');
  });
});

describe('filterRevenueDays', () => {
  const period = { year: 2026, month: 6, dayFrom: 1, dayTo: 11 };
  const days = Array.from({ length: 11 }, (_, i) => ({ day: i + 1 }));

  it('keeps last 7 days for week granularity', () => {
    expect(filterRevenueDays(days, period, 'week')).toHaveLength(7);
  });
});
