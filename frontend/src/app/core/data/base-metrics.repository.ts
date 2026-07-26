import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../config/api-config.token';
import type {
  BaseMetricName,
  DefaultPeriodApi,
  MetricBatchApi,
  MetricBoundsApi,
  MetricCompareApi,
  MetricForecastApi,
  MetricSeriesApi,
  MetricSnapshotApi,
  SeriesGranularity,
  SnapshotMode,
  UnitsResponseApi,
} from '../../shared/models/base-metrics-api.model';

export interface BaseMetricsRange {
  dateFrom: string;
  dateTo: string;
}

@Injectable({ providedIn: 'root' })
export class BaseMetricsRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_CONFIG);

  private url(path: string): string {
    return `${this.api.apiBase}/base-metrics${path}`;
  }

  private rangeParams(range: BaseMetricsRange): HttpParams {
    return new HttpParams()
      .set('date_from', range.dateFrom)
      .set('date_to', range.dateTo);
  }

  getBounds(): Observable<HttpResponse<MetricBoundsApi>> {
    return this.http.get<MetricBoundsApi>(this.url('/bounds'), {
      observe: 'response',
      withCredentials: true,
    });
  }

  getDefaultPeriod(): Observable<DefaultPeriodApi> {
    return this.http.get<DefaultPeriodApi>(this.url('/period/default'), {
      withCredentials: true,
    });
  }

  getBatch(
    metrics: BaseMetricName[],
    range: BaseMetricsRange,
    options: {
      includeCompare?: boolean;
      baseFrom?: string;
      baseTo?: string;
    } = {},
  ): Observable<MetricBatchApi> {
    let params = this.rangeParams(range).set('metrics', metrics.join(','));
    if (options.includeCompare) {
      params = params.set('include_compare', 'true');
    }
    if (options.baseFrom && options.baseTo) {
      params = params
        .set('base_from', options.baseFrom)
        .set('base_to', options.baseTo);
    }
    return this.http.get<MetricBatchApi>(this.url('/batch'), {
      params,
      withCredentials: true,
    });
  }

  getUnits(
    range: BaseMetricsRange,
    options: {
      includeCompare?: boolean;
      baseFrom?: string;
      baseTo?: string;
    } = {},
  ): Observable<UnitsResponseApi> {
    let params = this.rangeParams(range);
    if (options.includeCompare === false) {
      params = params.set('include_compare', 'false');
    }
    if (options.baseFrom && options.baseTo) {
      params = params
        .set('base_from', options.baseFrom)
        .set('base_to', options.baseTo);
    }
    return this.http.get<UnitsResponseApi>(this.url('/units'), {
      params,
      withCredentials: true,
    });
  }

  getSeries(
    metric: BaseMetricName,
    range: BaseMetricsRange,
    granularity: SeriesGranularity = 'day',
  ): Observable<MetricSeriesApi> {
    const params = this.rangeParams(range).set('granularity', granularity);
    return this.http.get<MetricSeriesApi>(this.url(`/${metric}/series`), {
      params,
      withCredentials: true,
    });
  }

  getForecast(
    metric: 'revenue' | 'checks' | 'guests',
    range: BaseMetricsRange,
    yearMode = false,
  ): Observable<MetricForecastApi> {
    let params = this.rangeParams(range);
    if (yearMode) {
      params = params.set('year_mode', 'true');
    }
    return this.http.get<MetricForecastApi>(this.url(`/${metric}/forecast`), {
      params,
      withCredentials: true,
    });
  }

  getSnapshot(
    options: {
      mode?: SnapshotMode;
      year?: number;
      month?: number;
      dateFrom?: string;
      dateTo?: string;
      baseFrom?: string;
      baseTo?: string;
      weekStart?: string;
      weekEnd?: string;
      anchorYear?: number;
      anchorMonth?: number;
      etag?: string | null;
    } = {},
  ): Observable<HttpResponse<MetricSnapshotApi>> {
    let params = new HttpParams().set('mode', options.mode ?? 'full');
    if (options.year != null) {
      params = params.set('year', String(options.year));
    }
    if (options.month != null) {
      params = params.set('month', String(options.month));
    }
    if (options.dateFrom && options.dateTo) {
      params = params
        .set('date_from', options.dateFrom)
        .set('date_to', options.dateTo);
    }
    if (options.baseFrom && options.baseTo) {
      params = params
        .set('base_from', options.baseFrom)
        .set('base_to', options.baseTo);
    }
    if (options.weekStart && options.weekEnd) {
      params = params
        .set('week_start', options.weekStart)
        .set('week_end', options.weekEnd);
    }
    if (options.anchorYear != null) {
      params = params.set('anchor_year', String(options.anchorYear));
    }
    if (options.anchorMonth != null) {
      params = params.set('anchor_month', String(options.anchorMonth));
    }
    let headers = new HttpHeaders();
    if (options.etag) {
      headers = headers.set('If-None-Match', options.etag);
    }
    return this.http.get<MetricSnapshotApi>(this.url('/snapshot'), {
      params,
      headers,
      observe: 'response',
      withCredentials: true,
    });
  }
}
