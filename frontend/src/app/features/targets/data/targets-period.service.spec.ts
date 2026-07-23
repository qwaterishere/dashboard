import { TestBed } from '@angular/core/testing';

import { TargetsPeriodService } from './targets-period.service';

describe('TargetsPeriodService', () => {
  let service: TargetsPeriodService;

  beforeEach(() => {
    sessionStorage.removeItem('sezony-targets-period');
    TestBed.configureTestingModule({});
    service = TestBed.inject(TargetsPeriodService);
  });

  afterEach(() => {
    sessionStorage.removeItem('sezony-targets-period');
  });

  it('setMonth stores year and month', () => {
    service.setMonth(2026, 8);
    expect(service.selection()).toEqual({ year: 2026, month: 8 });
  });

  it('ensureBootstrapped uses latestSalesDay month once', () => {
    service.ensureBootstrapped('2026-06-10');
    expect(service.selection()).toEqual({ year: 2026, month: 6 });

    service.ensureBootstrapped('2026-01-01');
    expect(service.selection()).toEqual({ year: 2026, month: 6 });
  });

  it('ensureBootstrapped falls back to calendar month without anchor', () => {
    service.ensureBootstrapped(null);
    const selection = service.selection();
    expect(selection).not.toBeNull();
    expect(selection!.month).toBeGreaterThanOrEqual(1);
    expect(selection!.month).toBeLessThanOrEqual(12);
  });

  it('selectCurrentMonth sets calendar month', () => {
    const now = new Date();
    service.setMonth(2020, 1);
    service.selectCurrentMonth();
    expect(service.selection()).toEqual({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    });
  });

  it('restores snapshot from sessionStorage', () => {
    sessionStorage.setItem(
      'sezony-targets-period',
      JSON.stringify({ year: 2026, month: 3 }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const next = TestBed.inject(TargetsPeriodService);
    expect(next.selection()).toEqual({ year: 2026, month: 3 });
  });
});
