import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';

import { createPageResource } from '../../../core/api/page-data.resource';
import { AnalyticsDataSyncService } from '../../../core/data/analytics-data-sync.service';
import { PeriodService } from '../../../core/services/period.service';
import type { SalesData } from '../../../shared/models';
import { computeSalesRaw } from './sales-aggregation.utils';
import { readSalesDayQuery } from './sales-route-query.utils';

@Injectable({ providedIn: 'root' })
export class SalesDataStore {
  private readonly periodService = inject(PeriodService);
  private readonly router = inject(Router);
  private readonly sync = inject(AnalyticsDataSyncService);

  private readonly dayQuery = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => readSalesDayQuery(this.router.url)),
      startWith(readSalesDayQuery(this.router.url)),
    ),
    { initialValue: readSalesDayQuery(this.router.url) },
  );

  readonly data = createPageResource<SalesData>(() => 'sales', () => {
    const dayQuery = this.dayQuery();
    if (dayQuery) {
      return {
        query: { date_from: dayQuery.dateFrom, date_to: dayQuery.dateTo },
      };
    }

    const useRange = this.periodService.granularity() === 'week';
    const query = useRange ? this.periodService.salesQuery() : null;
    if (!query) {
      return {};
    }
    return { query: { date_from: query.dateFrom, date_to: query.dateTo } };
  });

  readonly positions = computed(() => {
    if (!this.data.hasValue()) return [];
    return computeSalesRaw(this.data.value().positions);
  });

  constructor() {
    this.sync.register('sales', this.data);
  }
}
