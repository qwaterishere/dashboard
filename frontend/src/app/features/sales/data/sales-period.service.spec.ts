import { TestBed } from '@angular/core/testing';

import { SalesPeriodService } from './sales-period.service';

describe('SalesPeriodService', () => {
  let service: SalesPeriodService;

  beforeEach(() => {
    sessionStorage.removeItem('sezony-sales-period');
    TestBed.configureTestingModule({});
    service = TestBed.inject(SalesPeriodService);
  });

  afterEach(() => {
    sessionStorage.removeItem('sezony-sales-period');
  });

  it('setPreset day/week/month compute ISO ranges from anchor', () => {
    service.setPreset('day', '2026-06-10');
    expect(service.preset()).toBe('day');
    expect(service.range()).toEqual({ dateFrom: '2026-06-10', dateTo: '2026-06-10' });

    service.setPreset('week', '2026-06-10');
    expect(service.preset()).toBe('week');
    expect(service.range()).toEqual({ dateFrom: '2026-06-08', dateTo: '2026-06-14' });

    service.setPreset('month', '2026-06-10');
    expect(service.preset()).toBe('month');
    expect(service.range()).toEqual({ dateFrom: '2026-06-01', dateTo: '2026-06-10' });
  });

  it('setRange marks custom and normalizes order', () => {
    service.setRange('2026-06-20', '2026-06-05');
    expect(service.preset()).toBe('custom');
    expect(service.range()).toEqual({ dateFrom: '2026-06-05', dateTo: '2026-06-20' });
  });

  it('applyApiPeriod updates truncated bounds without changing preset', () => {
    service.setPreset('month', '2026-06-30');
    expect(service.preset()).toBe('month');
    service.applyApiPeriod('2026-06-01', '2026-06-16');
    expect(service.preset()).toBe('month');
    expect(service.range()).toEqual({ dateFrom: '2026-06-01', dateTo: '2026-06-16' });
  });

  it('ensureBootstrapped defaults to month of anchor once', () => {
    service.ensureBootstrapped(null);
    expect(service.range()).toBeNull();

    service.ensureBootstrapped('2026-06-10');
    expect(service.preset()).toBe('month');
    expect(service.range()).toEqual({ dateFrom: '2026-06-01', dateTo: '2026-06-10' });

    service.ensureBootstrapped('2026-05-01');
    expect(service.range()?.dateTo).toBe('2026-06-10');
  });

  it('restores snapshot from sessionStorage', () => {
    sessionStorage.setItem(
      'sezony-sales-period',
      JSON.stringify({
        preset: 'week',
        range: { dateFrom: '2026-06-08', dateTo: '2026-06-14' },
      }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const next = TestBed.inject(SalesPeriodService);
    expect(next.preset()).toBe('week');
    expect(next.range()).toEqual({ dateFrom: '2026-06-08', dateTo: '2026-06-14' });
  });
});
