import { TestBed } from '@angular/core/testing';

import { CurrencyService } from './currency.service';
import { getActiveCurrencySymbol } from '../../shared/utils/money-format.utils';

describe('CurrencyService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('defaults to RUB', () => {
    const service = TestBed.inject(CurrencyService);
    TestBed.flushEffects();
    expect(service.code()).toBe('RUB');
    expect(getActiveCurrencySymbol()).toBe('₽');
  });

  it('persists currency selection', () => {
    const service = TestBed.inject(CurrencyService);
    TestBed.flushEffects();
    service.setCurrency('KGS');
    TestBed.flushEffects();
    expect(service.code()).toBe('KGS');
    expect(localStorage.getItem('sezony-currency')).toBe('KGS');
    expect(getActiveCurrencySymbol()).toBe('с');
  });

  it('restores stored currency', () => {
    localStorage.setItem('sezony-currency', 'USD');
    const service = TestBed.inject(CurrencyService);
    TestBed.flushEffects();
    expect(service.code()).toBe('USD');
    expect(getActiveCurrencySymbol()).toBe('$');
  });
});
