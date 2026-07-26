import { computed, effect, inject, Injectable, untracked } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { AnalyticsDataSyncService } from '../../../core/data/analytics-data-sync.service';
import { DataFreshnessService } from '../../../core/data/data-freshness.service';
import { SalesRepository } from '../../../core/data/sales.repository';
import { computeSalesRaw } from './sales-aggregation.utils';
import { SalesPeriodService } from './sales-period.service';
import { readSalesDayQuery } from './sales-route-query.utils';

@Injectable({ providedIn: 'root' })
export class SalesDataStore {
  private readonly salesPeriod = inject(SalesPeriodService);
  private readonly freshness = inject(DataFreshnessService);
  private readonly router = inject(Router);
  private readonly sync = inject(AnalyticsDataSyncService);
  private readonly salesRepository = inject(SalesRepository);

  private readonly dayQuery = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => readSalesDayQuery(this.router.url)),
      startWith(readSalesDayQuery(this.router.url)),
    ),
    { initialValue: readSalesDayQuery(this.router.url) },
  );

  readonly data = rxResource({
    params: () => {
      const range = this.salesPeriod.range();
      if (!range) return undefined;
      return { dateFrom: range.dateFrom, dateTo: range.dateTo };
    },
    stream: ({ params }) => this.salesRepository.getSnapshot(params),
  });

  readonly positions = computed(() => {
    if (!this.data.hasValue()) return [];
    return computeSalesRaw(this.data.value().positions);
  });

  constructor() {
    this.sync.register('sales', this.data);

    // URL seed с дашборда (?date_from&date_to) → один раз в сервис, query убрать
    effect(() => {
      const q = this.dayQuery();
      if (!q) return;
      untracked(() => {
        this.salesPeriod.setRange(q.dateFrom, q.dateTo);
        void this.router.navigate(['/sales'], { replaceUrl: true });
      });
    });

    // Bootstrap: месяц last closed из freshness
    effect(() => {
      const fresh = this.freshness.freshness();
      untracked(() => {
        this.salesPeriod.ensureBootstrapped(fresh?.latestSalesDay ?? null);
      });
    });

    // Синхронизация усечённых границ ответа API
    effect(() => {
      if (!this.data.hasValue()) return;
      const period = this.data.value().period;
      untracked(() => {
        this.salesPeriod.applyApiPeriod(period.dateFrom ?? null, period.dateTo ?? null);
      });
    });
  }
}
