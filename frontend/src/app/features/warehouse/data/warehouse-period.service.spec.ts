import { TestBed } from '@angular/core/testing';

import { WarehousePeriodService } from './warehouse-period.service';

describe('WarehousePeriodService', () => {
  let service: WarehousePeriodService;

  beforeEach(() => {
    sessionStorage.removeItem('sezony-warehouse-period');
    TestBed.configureTestingModule({});
    service = TestBed.inject(WarehousePeriodService);
  });

  afterEach(() => {
    sessionStorage.removeItem('sezony-warehouse-period');
  });

  it('defaults to latest (null)', () => {
    expect(service.selection()).toBeNull();
    expect(service.queryDate()).toBeUndefined();
  });

  it('setDay stores ISO and queryDate', () => {
    service.setDay('2026-07-14');
    expect(service.selection()).toBe('2026-07-14');
    expect(service.queryDate()).toBe('2026-07-14');
  });

  it('ignores invalid ISO', () => {
    service.setDay('2026-07-14');
    service.setDay('nope');
    expect(service.selection()).toBe('2026-07-14');
  });

  it('selectLatest clears to null', () => {
    service.setDay('2026-07-14');
    service.selectLatest();
    expect(service.selection()).toBeNull();
    expect(service.queryDate()).toBeUndefined();
  });

  it('restores day from sessionStorage', () => {
    sessionStorage.setItem(
      'sezony-warehouse-period',
      JSON.stringify({ iso: '2026-06-01' }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const next = TestBed.inject(WarehousePeriodService);
    expect(next.selection()).toBe('2026-06-01');
  });
});
