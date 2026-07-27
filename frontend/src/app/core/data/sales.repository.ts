import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../config/api-config.token';
import type { SalesData } from '../../shared/models';

export interface SalesSnapshotQuery {
  dateFrom?: string;
  dateTo?: string;
}

/** REST /api/sales/* — снимок продаж. */
@Injectable({ providedIn: 'root' })
export class SalesRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_CONFIG);

  getSnapshot(query: SalesSnapshotQuery = {}): Observable<SalesData> {
    let params = new HttpParams();
    if (query.dateFrom) {
      params = params.set('date_from', query.dateFrom);
    }
    if (query.dateTo) {
      params = params.set('date_to', query.dateTo);
    }
    return this.http.get<SalesData>(`${this.api.apiBase}/sales/snapshot`, {
      params,
      withCredentials: true,
    });
  }
}
