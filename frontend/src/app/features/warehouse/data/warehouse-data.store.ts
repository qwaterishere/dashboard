import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { createPageResource } from '../../../core/api/page-data.resource';
import { AnalyticsDataSyncService } from '../../../core/data/analytics-data-sync.service';
import type { WarehouseApi } from '../../../shared/models/warehouse-api.model';
import type { WarehouseData } from '../../../shared/models/warehouse.model';
import { buildWarehouseViewModel } from './warehouse.mapper';

export interface WarehouseResourceFacade {
  hasValue(): boolean;
  value(): WarehouseData;
  error(): unknown | null;
  isLoading(): boolean;
  reload(): void;
  /** Слепков нет (новый ресторан / ещё не синкали склад). */
  isEmpty(): boolean;
}

function isNotFound(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 404;
}

/** Единый источник данных склада для dashboard и warehouse page. */
@Injectable({ providedIn: 'root' })
export class WarehouseDataStore {
  private readonly sync = inject(AnalyticsDataSyncService);

  /** ISO-дата слепка (`?date`); null — latest с бэка. */
  readonly selectedDate = signal<string | null>(null);

  private readonly raw = createPageResource<WarehouseApi>(() => 'warehouse', () => {
    const date = this.selectedDate();
    return date ? { query: { date } } : {};
  });

  private readonly viewModel = computed(() => {
    if (!this.raw.hasValue()) return null;
    return buildWarehouseViewModel(this.raw.value());
  });

  readonly data: WarehouseResourceFacade = {
    hasValue: () => this.viewModel() !== null,
    value: () => this.viewModel()!,
    error: () => this.raw.error(),
    isLoading: () => this.raw.isLoading(),
    reload: () => this.raw.reload(),
    isEmpty: () => isNotFound(this.raw.error()),
  };

  constructor() {
    this.sync.register('warehouse', this.data);
  }

  setSelectedDate(iso: string | null): void {
    this.selectedDate.set(iso);
  }
}
