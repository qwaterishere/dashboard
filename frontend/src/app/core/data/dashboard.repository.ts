import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import {
  assembleDashboardChart,
  assembleDashboardFull,
  assembleDashboardKpi,
} from './dashboard-assemble';
import { BaseMetricsRepository } from './base-metrics.repository';
import { TargetsRepository } from './targets.repository';
import type { DashboardApi, DashboardCompareSlice } from '../../shared/models/dashboard-api.model';
import type { DashboardChartApi } from '../../shared/models/dashboard-chart-api.model';
import type { DashboardQueryKey } from './analytics-cache-key';
import type { DashboardCacheLoaderResult } from './dashboard-cache.service';
import type { DashboardCompareCacheLoaderResult } from './dashboard-compare-cache.service';

export interface DashboardFetchOptions {
  etag?: string | null;
}

/**
 * Дашборд собирается на клиенте из /api/base-metrics/* (+ /api/targets для планов).
 * Форма DashboardApi сохранена для store/mappers.
 */
@Injectable({ providedIn: 'root' })
export class DashboardRepository {
  private readonly metrics = inject(BaseMetricsRepository);
  private readonly targets = inject(TargetsRepository);

  private get deps() {
    return { metrics: this.metrics, targets: this.targets };
  }

  fetch(
    query: DashboardQueryKey,
    _options: DashboardFetchOptions = {},
  ): Observable<DashboardCacheLoaderResult> {
    return assembleDashboardFull(this.deps, query).pipe(
      map(({ data, etag }) => ({ kind: 'ok' as const, data, etag })),
    );
  }

  fetchChart(
    query: DashboardQueryKey,
    _options: DashboardFetchOptions = {},
  ): Observable<DashboardCacheLoaderResult> {
    return assembleDashboardChart(this.deps, query).pipe(
      map(({ data, etag }) => ({
        kind: 'ok' as const,
        data: this.chartApiToDashboardApi(data),
        etag,
      })),
    );
  }

  fetchKpi(
    query: DashboardQueryKey,
    _options: DashboardFetchOptions = {},
  ): Observable<DashboardCompareCacheLoaderResult> {
    return assembleDashboardKpi(this.deps, query).pipe(
      map(({ data, etag }) => {
        const slice: DashboardCompareSlice = {
          kpis: data.kpis,
          compare: data.compare,
          weekKpi: data.weekKpi ?? null,
        };
        return { kind: 'ok' as const, data: slice, etag };
      }),
    );
  }

  private chartApiToDashboardApi(chart: DashboardChartApi): DashboardApi {
    const empty = {
      value: 0,
      prevValue: null as number | null,
      forecast: null as number | null,
      forecastToday: null as number | null,
    };
    return {
      period: chart.period,
      compare: chart.compare,
      dataBounds: chart.dataBounds,
      kpis: {
        revenue: { ...empty },
        checks: { ...empty },
        guests: { ...empty },
        avgCheck: { ...empty },
      },
      revenueByDay: chart.revenueByDay,
      revenueByMonth: chart.revenueByMonth,
      units: chart.units,
      weekKpi: chart.weekKpi ?? null,
      reviews: null,
      stock: null,
    };
  }
}
