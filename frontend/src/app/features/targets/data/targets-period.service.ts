import { effect, Injectable, signal } from '@angular/core';

import type { TargetsMonthSelection } from './targets-period.model';
import {
  currentCalendarMonth,
  parseTargetsAnchorIso,
} from './targets-period.utils';

const STORAGE_KEY = 'sezony-targets-period';

function readStored(): TargetsMonthSelection | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TargetsMonthSelection>;
    if (
      typeof parsed?.year !== 'number' ||
      typeof parsed?.month !== 'number' ||
      parsed.month < 1 ||
      parsed.month > 12 ||
      parsed.year < 2000 ||
      parsed.year > 2100
    ) {
      return null;
    }
    return { year: parsed.year, month: parsed.month };
  } catch {
    return null;
  }
}

function writeStored(selection: TargetsMonthSelection): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    /* private mode */
  }
}

@Injectable({ providedIn: 'root' })
export class TargetsPeriodService {
  readonly selection = signal<TargetsMonthSelection | null>(null);

  private bootstrapped = false;
  /** Якорь для ±2 лет в пикере (latestSalesDay year или текущий). */
  private anchorYear = currentCalendarMonth().year;

  constructor() {
    const stored = readStored();
    if (stored) {
      this.selection.set(stored);
      this.anchorYear = stored.year;
      this.bootstrapped = true;
    }

    effect(() => {
      const selection = this.selection();
      if (!selection) return;
      writeStored(selection);
    });
  }

  getPickerAnchorYear(): number {
    return this.anchorYear;
  }

  /**
   * Первый вход без sessionStorage: месяц latestSalesDay.
   * Без якоря — календарный текущий месяц (цели можно ставить вперёд).
   */
  ensureBootstrapped(anchorIso: string | null): void {
    if (this.bootstrapped || this.selection()) {
      this.bootstrapped = true;
      return;
    }
    const fromIso = anchorIso ? parseTargetsAnchorIso(anchorIso) : null;
    const next = fromIso ?? currentCalendarMonth();
    this.anchorYear = next.year;
    this.selection.set(next);
    this.bootstrapped = true;
  }

  setMonth(year: number, month: number): void {
    if (month < 1 || month > 12 || year < 2000 || year > 2100) return;
    this.selection.set({ year, month });
    this.bootstrapped = true;
  }

  /** Календарный текущий месяц (не latestSalesDay). */
  selectCurrentMonth(): void {
    const current = currentCalendarMonth();
    this.setMonth(current.year, current.month);
  }
}
