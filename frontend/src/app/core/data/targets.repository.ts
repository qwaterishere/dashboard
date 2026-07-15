import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../config/api-config.token';
import type { TargetsData, TargetsUpsertRequest } from '../../shared/models/targets.model';

export interface TargetsQuery {
  year?: number | null;
  month?: number | null;
}

@Injectable({ providedIn: 'root' })
export class TargetsRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_CONFIG);

  fetch(query: TargetsQuery = {}): Observable<TargetsData> {
    let params = new HttpParams();
    if (query.year != null && query.month != null) {
      params = params.set('year', String(query.year)).set('month', String(query.month));
    }
    return this.http.get<TargetsData>(`${this.api.apiBase}/targets`, {
      params,
      withCredentials: true,
    });
  }

  save(payload: TargetsUpsertRequest): Observable<TargetsData> {
    return this.http.put<TargetsData>(`${this.api.apiBase}/targets`, payload, {
      withCredentials: true,
    });
  }
}
