import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';

import { AnalyticsDataSyncService } from '../../../core/data/analytics-data-sync.service';
import { StockRepository } from '../../../core/data/stock.repository';
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
  private readonly stockRepository = inject(StockRepository);

  /** ISO-дата слепка (`?date`); null — latest с бэка. */
  readonly selectedDate = signal<string | null>(null);

  private readonly raw = rxResource({
    params: () => ({
      date: this.selectedDate() ?? undefined,
    }),
    stream: ({ params }) => this.stockRepository.getSnapshot(params),
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
