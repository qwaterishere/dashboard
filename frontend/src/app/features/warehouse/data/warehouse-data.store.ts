import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';

import { AnalyticsDataSyncService } from '../../../core/data/analytics-data-sync.service';
import { StockRepository } from '../../../core/data/stock.repository';
import type { WarehouseData } from '../../../shared/models/warehouse.model';
import { buildWarehouseViewModel } from './warehouse.mapper';
import { WarehousePeriodService } from './warehouse-period.service';

export interface WarehouseResourceFacade {
  hasValue(): boolean;
  value(): WarehouseData;
  error(): unknown | null;
  isLoading(): boolean;
  reload(): void;
  /** Слепков нет (новый ресторан / ещё не синкали склад). */
  isEmpty(): boolean;
  /** Перезагрузка карточек при смене дня (график не затрагивается). */
  cardsLoading(): boolean;
  /** Первичная загрузка ряда динамики. */
  chartLoading(): boolean;
}

function isNotFound(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 404;
}

/** Единый источник данных склада для dashboard и warehouse page. */
@Injectable({ providedIn: 'root' })
export class WarehouseDataStore {
  private readonly sync = inject(AnalyticsDataSyncService);
  private readonly stockRepository = inject(StockRepository);
  private readonly warehousePeriod = inject(WarehousePeriodService);

  /**
   * Полный снимок latest + динамика. Не зависит от выбранного дня —
   * график и календарные bounds стабильны при смене даты.
   */
  private readonly dynamicsRaw = rxResource({
    stream: () => this.stockRepository.getSnapshot({}),
  });

  /**
   * Слепок на выбранный день (карточки). `undefined` params → не грузим
   * (режим «текущий день» берёт данные из dynamicsRaw).
   */
  private readonly snapshotRaw = rxResource({
    params: () => {
      const date = this.warehousePeriod.queryDate();
      return date ? { date } : undefined;
    },
    stream: ({ params }) =>
      this.stockRepository.getSnapshot({
        date: params.date,
        // Минимальный payload dynamics — карточкам ряд не нужен.
        dateFrom: params.date,
        dateTo: params.date,
      }),
  });

  /** Последний успешный VM для карточек (stale-while-revalidate). */
  private readonly cardsVm = signal<WarehouseData | null>(null);

  private readonly viewModel = computed(() => {
    const cards = this.cardsVm();
    const dynApi = this.dynamicsRaw.hasValue() ? this.dynamicsRaw.value() : null;
    const dyn = dynApi ? buildWarehouseViewModel(dynApi) : null;

    if (!cards && !dyn) return null;
    if (!dyn) return cards;
    if (!cards) return dyn;

    return {
      ...cards,
      dynamicsPoints: dyn.dynamicsPoints,
      dataBounds: dyn.dataBounds,
    };
  });

  readonly data: WarehouseResourceFacade = {
    hasValue: () => this.viewModel() !== null,
    value: () => this.viewModel()!,
    error: () => this.dynamicsRaw.error() ?? this.snapshotRaw.error(),
    isLoading: () =>
      (!this.viewModel() && (this.dynamicsRaw.isLoading() || this.snapshotRaw.isLoading())),
    reload: () => {
      this.dynamicsRaw.reload();
      this.snapshotRaw.reload();
    },
    isEmpty: () =>
      isNotFound(this.dynamicsRaw.error()) || isNotFound(this.snapshotRaw.error()),
    cardsLoading: () => {
      if (!this.viewModel()) return false;
      // Оверлей только при смене выбранного дня — не при фоновом refresh динамики.
      return !!this.warehousePeriod.queryDate() && this.snapshotRaw.isLoading();
    },
    chartLoading: () => this.dynamicsRaw.isLoading() && !this.dynamicsRaw.hasValue(),
  };

  constructor() {
    this.sync.register('warehouse', this.data);

    // Карточки: latest ← dynamics; выбранный день ← snapshot (не затираем stale при reload).
    effect(() => {
      const date = this.warehousePeriod.queryDate();
      if (!date) {
        if (!this.dynamicsRaw.hasValue()) return;
        const vm = buildWarehouseViewModel(this.dynamicsRaw.value());
        untracked(() => this.cardsVm.set(vm));
        return;
      }
      if (!this.snapshotRaw.hasValue()) return;
      const vm = buildWarehouseViewModel(this.snapshotRaw.value());
      untracked(() => this.cardsVm.set(vm));
    });

    // Если в sessionStorage день без слепка — откат на latest.
    effect(() => {
      const vm = this.viewModel();
      const selected = this.warehousePeriod.selection();
      if (!vm || !selected) return;
      const available = new Set(vm.dataBounds.availableDates);
      if (!available.has(selected)) {
        untracked(() => this.warehousePeriod.selectLatest());
      }
    });

    effect(() => {
      const selected = this.warehousePeriod.selection();
      if (selected && isNotFound(this.snapshotRaw.error())) {
        untracked(() => this.warehousePeriod.selectLatest());
      }
    });
  }
}
