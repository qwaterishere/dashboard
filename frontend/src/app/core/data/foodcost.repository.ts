import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { API_CONFIG } from '../config/api-config.token';
import type { DashboardQueryKey } from './analytics-cache-key';
import type { FoodcostApi } from '../../shared/models/foodcost-api.model';
import type { FoodcostCacheLoaderResult } from './foodcost-cache.service';

export interface FoodcostFetchOptions {
  etag?: string | null;
}

@Injectable({ providedIn: 'root' })
export class FoodcostRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_CONFIG);

  fetch(
    query: DashboardQueryKey,
    options: FoodcostFetchOptions = {},
  ): Observable<FoodcostCacheLoaderResult> {
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
      .get<FoodcostApi>(`${this.api.apiBase}/foodcost`, {
        params,
        headers,
        observe: 'response',
      })
      .pipe(map((response) => this.mapResponse(response, options.etag ?? null)));
  }

  private mapResponse(
    response: HttpResponse<FoodcostApi>,
    sentEtag: string | null,
  ): FoodcostCacheLoaderResult {
    if (response.status === 304) {
      return { kind: 'not-modified' };
    }
    if (response.body == null) {
      throw new Error('Foodcost response body is empty');
    }
    return {
      kind: 'ok',
      data: response.body,
      etag: response.headers.get('ETag') ?? sentEtag,
    };
  }
}
