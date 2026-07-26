import { effect, Injectable, signal } from '@angular/core';

import type { WarehouseDaySelection } from './warehouse-period.model';
import { parseWarehouseIso } from './warehouse-period.utils';

const STORAGE_KEY = 'sezony-warehouse-period';

function readStored(): WarehouseDaySelection {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    if (raw === '' || raw === 'null' || raw === 'latest') return null;
    const parsed = JSON.parse(raw) as { iso?: string } | string;
    const iso = typeof parsed === 'string' ? parsed : parsed?.iso;
    if (typeof iso !== 'string' || !parseWarehouseIso(iso)) return null;
    return iso;
  } catch {
    return null;
  }
}

function writeStored(selection: WarehouseDaySelection): void {
  try {
    if (selection === null) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(null));
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ iso: selection }));
  } catch {
    /* private mode */
  }
}

@Injectable({ providedIn: 'root' })
export class WarehousePeriodService {
  /**
   * `null` — последний слепок («Текущий день»).
   * ISO — выбранный день.
   */
  readonly selection = signal<WarehouseDaySelection>(null);

  constructor() {
    this.selection.set(readStored());

    effect(() => {
      writeStored(this.selection());
    });
  }

  /** Последний доступный слепок (дефолт). */
  selectLatest(): void {
    this.selection.set(null);
  }

  setDay(iso: string): void {
    if (!parseWarehouseIso(iso)) return;
    this.selection.set(iso);
  }

  /** Query-параметр для StockRepository (`undefined` = latest). */
  queryDate(): string | undefined {
    return this.selection() ?? undefined;
  }
}
