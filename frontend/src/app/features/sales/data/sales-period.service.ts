import { effect, Injectable, signal } from '@angular/core';

import type { SalesDateRange, SalesPeriodPreset, SalesPeriodSnapshot } from './sales-period.model';
import {
  computeSalesPresetRange,
  normalizeSalesDateRange,
  todayIsoDate,
} from './sales-period-range.utils';

const STORAGE_KEY = 'sezony-sales-period';

function readStored(): SalesPeriodSnapshot | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SalesPeriodSnapshot>;
    if (
      !parsed?.range?.dateFrom ||
      !parsed?.range?.dateTo ||
      !parsed.preset ||
      !['day', 'week', 'month', 'custom'].includes(parsed.preset)
    ) {
      return null;
    }
    return {
      preset: parsed.preset,
      range: normalizeSalesDateRange(parsed.range.dateFrom, parsed.range.dateTo),
    };
  } catch {
    return null;
  }
}

function writeStored(snapshot: SalesPeriodSnapshot): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* private mode */
  }
}

@Injectable({ providedIn: 'root' })
export class SalesPeriodService {
  readonly preset = signal<SalesPeriodPreset>('month');
  readonly range = signal<SalesDateRange | null>(null);

  private bootstrapped = false;

  constructor() {
    const stored = readStored();
    if (stored) {
      this.preset.set(stored.preset);
      this.range.set(stored.range);
      this.bootstrapped = true;
    }

    effect(() => {
      const range = this.range();
      const preset = this.preset();
      if (!range) return;
      writeStored({ preset, range });
    });
  }

  /**
   * Первый вход без sessionStorage: месяц якоря (latestSalesDay).
   * Без якоря не трогаем state — ждём freshness или URL seed.
   */
  ensureBootstrapped(anchorIso: string | null): void {
    if (this.bootstrapped || this.range()) {
      this.bootstrapped = true;
      return;
    }
    if (!anchorIso || !/^\d{4}-\d{2}-\d{2}$/.test(anchorIso)) {
      return;
    }
    this.setPreset('month', anchorIso);
    this.bootstrapped = true;
  }

  setPreset(preset: Exclude<SalesPeriodPreset, 'custom'>, anchorIso?: string): void {
    const anchor = anchorIso ?? this.range()?.dateTo ?? todayIsoDate();
    this.preset.set(preset);
    this.range.set(computeSalesPresetRange(preset, anchor));
    this.bootstrapped = true;
  }

  setRange(dateFrom: string, dateTo: string): void {
    this.preset.set('custom');
    this.range.set(normalizeSalesDateRange(dateFrom, dateTo));
    this.bootstrapped = true;
  }

  /** Синхронизация усечённых границ из ответа API (не меняет preset). */
  applyApiPeriod(dateFrom: string | null, dateTo: string | null): void {
    if (!dateFrom || !dateTo) return;
    const current = this.range();
    if (current?.dateFrom === dateFrom && current?.dateTo === dateTo) return;
    this.range.set({ dateFrom, dateTo });
    this.bootstrapped = true;
  }
}
