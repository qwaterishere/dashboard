import { effect, Injectable, signal } from '@angular/core';

import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  isCurrencyCode,
  type CurrencyCode,
  type CurrencyOption,
} from '../../shared/constants/currency.constants';
import { setActiveCurrencyCode } from '../../shared/utils/money-format.utils';

const STORAGE_KEY = 'sezony-currency';

@Injectable({ providedIn: 'root' })
export class CurrencyService {
  readonly currencies: readonly CurrencyOption[] = CURRENCIES;
  readonly code = signal<CurrencyCode>(this.readStored());

  constructor() {
    effect(() => this.apply(this.code()));
  }

  setCurrency(code: CurrencyCode): void {
    this.code.set(code);
  }

  symbol(): string {
    return this.currencies.find((c) => c.code === this.code())?.symbol ?? '₽';
  }

  private apply(code: CurrencyCode): void {
    setActiveCurrencyCode(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* private mode / blocked storage */
    }
  }

  private readStored(): CurrencyCode {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (isCurrencyCode(stored)) return stored;
    } catch {
      /* ignore */
    }
    return DEFAULT_CURRENCY;
  }
}
