import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../config/api-config.token';
import type { WarehouseApi } from '../../shared/models/warehouse-api.model';

export interface StockSnapshotQuery {
  date?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** REST /api/stock/* — складские слепки. */
@Injectable({ providedIn: 'root' })
export class StockRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_CONFIG);

  getSnapshot(query: StockSnapshotQuery = {}): Observable<WarehouseApi> {
    let params = new HttpParams();
    if (query.date) {
      params = params.set('date', query.date);
    }
    if (query.dateFrom) {
      params = params.set('date_from', query.dateFrom);
    }
    if (query.dateTo) {
      params = params.set('date_to', query.dateTo);
    }
    return this.http.get<WarehouseApi>(`${this.api.apiBase}/stock/snapshot`, {
      params,
      withCredentials: true,
    });
  }
}
