import { TestBed } from '@angular/core/testing';

import { PeriodService } from './period.service';

describe('PeriodService', () => {
  it('defaults granularity to month', () => {
    const service = TestBed.inject(PeriodService);
    expect(service.granularity()).toBe('month');
  });

  it('returns null salesQuery without dashboard period', () => {
    const service = TestBed.inject(PeriodService);
    expect(service.salesQuery()).toBeNull();
  });

  it('builds salesQuery for week granularity', () => {
    const service = TestBed.inject(PeriodService);
    service.dashboardPeriod.set({ year: 2026, month: 6, dayFrom: 1, dayTo: 11 });
    service.granularity.set('week');
    expect(service.salesQuery()).toEqual({
      dateFrom: '2026-06-05',
      dateTo: '2026-06-11',
    });
  });
});
