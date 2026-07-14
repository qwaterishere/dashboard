import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { API_CONFIG } from '../config/api-config.token';
import type { DashboardApi } from '../../shared/models/dashboard-api.model';
import type { DashboardChartApi } from '../../shared/models/dashboard-chart-api.model';
import type { DashboardKpiApi } from '../../shared/models/dashboard-kpi-api.model';
import type { DashboardCompareSlice } from '../../shared/models/dashboard-api.model';
import type { DashboardQueryKey } from './analytics-cache-key';
import type { DashboardCacheLoaderResult } from './dashboard-cache.service';
import type { DashboardCompareCacheLoaderResult } from './dashboard-compare-cache.service';

export interface DashboardFetchOptions {
  etag?: string | null;
}

@Injectable({ providedIn: 'root' })
export class DashboardRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_CONFIG);

  fetch(
    query: DashboardQueryKey,
    options: DashboardFetchOptions = {},
  ): Observable<DashboardCacheLoaderResult> {
    let params = new HttpParams();
    if (query.year != null) {
      params = params.set('year', String(query.year));
    }
    if (query.month != null) {
      params = params.set('month', String(query.month));
    }
    if (query.weekStart) {
      params = params.set('weekStart', query.weekStart);
    }
    if (query.weekEnd) {
      params = params.set('weekEnd', query.weekEnd);
    }

    if (query.compareStart) {
      params = params.set('compareStart', query.compareStart);
    }
    if (query.compareEnd) {
      params = params.set('compareEnd', query.compareEnd);
    }

    let headers = new HttpHeaders();
    if (options.etag) {
      headers = headers.set('If-None-Match', options.etag);
    }

    return this.http
      .get<DashboardApi>(`${this.api.apiBase}/dashboard`, {
        params,
        headers,
        observe: 'response',
      })
      .pipe(map((response) => this.mapResponse(response, options.etag ?? null)));
  }

  fetchChart(
    query: DashboardQueryKey,
    options: DashboardFetchOptions = {},
  ): Observable<DashboardCacheLoaderResult> {
    let params = new HttpParams();
    if (query.year != null) {
      params = params.set('year', String(query.year));
    }
    if (query.month != null) {
      params = params.set('month', String(query.month));
    }
    if (query.weekStart) {
      params = params.set('weekStart', query.weekStart);
    }
    if (query.weekEnd) {
      params = params.set('weekEnd', query.weekEnd);
    }

    let headers = new HttpHeaders();
    if (options.etag) {
      headers = headers.set('If-None-Match', options.etag);
    }

    return this.http
      .get<DashboardChartApi>(`${this.api.apiBase}/dashboard/chart`, {
        params,
        headers,
        observe: 'response',
      })
      .pipe(map((response) => this.mapChartResponse(response, options.etag ?? null)));
  }

  fetchKpi(
    query: DashboardQueryKey,
    options: DashboardFetchOptions = {},
  ): Observable<DashboardCompareCacheLoaderResult> {
    let params = new HttpParams();
    if (query.year != null) {
      params = params.set('year', String(query.year));
    }
    if (query.month != null) {
      params = params.set('month', String(query.month));
    }
    if (query.weekStart) {
      params = params.set('weekStart', query.weekStart);
    }
    if (query.weekEnd) {
      params = params.set('weekEnd', query.weekEnd);
    }
    if (query.compareStart) {
      params = params.set('compareStart', query.compareStart);
    }
    if (query.compareEnd) {
      params = params.set('compareEnd', query.compareEnd);
    }

    let headers = new HttpHeaders();
    if (options.etag) {
      headers = headers.set('If-None-Match', options.etag);
    }

    return this.http
      .get<DashboardKpiApi>(`${this.api.apiBase}/dashboard/kpi`, {
        params,
        headers,
        observe: 'response',
      })
      .pipe(map((response) => this.mapKpiResponse(response, options.etag ?? null)));
  }

  private mapChartResponse(
    response: HttpResponse<DashboardChartApi>,
    sentEtag: string | null,
  ): DashboardCacheLoaderResult {
    if (response.status === 304) {
      return { kind: 'not-modified' };
    }
    if (response.body == null) {
      throw new Error('Dashboard chart response body is empty');
    }
    return {
      kind: 'ok',
      data: this.chartApiToDashboardApi(response.body),
      etag: response.headers.get('ETag') ?? sentEtag,
    };
  }

  private chartApiToDashboardApi(chart: DashboardChartApi): DashboardApi {
    const empty = { value: 0, prevValue: null as number | null, forecast: null as number | null };
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

  private mapKpiResponse(
    response: HttpResponse<DashboardKpiApi>,
    sentEtag: string | null,
  ): DashboardCompareCacheLoaderResult {
    if (response.status === 304) {
      return { kind: 'not-modified' };
    }
    if (response.body == null) {
      throw new Error('Dashboard KPI response body is empty');
    }
    const body = response.body;
    const data: DashboardCompareSlice = {
      kpis: body.kpis,
      compare: body.compare,
      weekKpi: body.weekKpi ?? null,
    };
    return {
      kind: 'ok',
      data,
      etag: response.headers.get('ETag') ?? sentEtag,
    };
  }

  private mapResponse(
    response: HttpResponse<DashboardApi>,
    sentEtag: string | null,
  ): DashboardCacheLoaderResult {
    if (response.status === 304) {
      return { kind: 'not-modified' };
    }
    if (response.body == null) {
      throw new Error('Dashboard response body is empty');
    }
    return {
      kind: 'ok',
      data: response.body,
      etag: response.headers.get('ETag') ?? sentEtag,
    };
  }
}
