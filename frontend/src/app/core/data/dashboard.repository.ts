import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { API_CONFIG } from '../config/api-config.token';
import type { DashboardV2 } from '../../shared/models/dashboard-v2.model';
import type { DashboardQueryKey } from './analytics-cache-key';
import type { DashboardCacheLoaderResult } from './dashboard-cache.service';

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

    let headers = new HttpHeaders();
    if (options.etag) {
      headers = headers.set('If-None-Match', options.etag);
    }

    return this.http
      .get<DashboardV2>(`${this.api.apiBase}/dashboard`, {
        params,
        headers,
        observe: 'response',
      })
      .pipe(map((response) => this.mapResponse(response, options.etag ?? null)));
  }

  private mapResponse(
    response: HttpResponse<DashboardV2>,
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
