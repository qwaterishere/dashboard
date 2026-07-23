import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../config/api-config.token';
import type {
  TargetsData,
  TargetsLockedList,
  TargetsUpsertRequest,
} from '../../shared/models/targets.model';

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

  listLocks(): Observable<TargetsLockedList> {
    return this.http.get<TargetsLockedList>(`${this.api.apiBase}/targets/locks`, {
      withCredentials: true,
    });
  }

  listConfigured(): Observable<TargetsLockedList> {
    return this.http.get<TargetsLockedList>(`${this.api.apiBase}/targets/configured`, {
      withCredentials: true,
    });
  }

  save(payload: TargetsUpsertRequest): Observable<TargetsData> {
    return this.http.put<TargetsData>(`${this.api.apiBase}/targets`, payload, {
      withCredentials: true,
    });
  }

  clear(query: { year: number; month: number }): Observable<TargetsData> {
    const params = new HttpParams()
      .set('year', String(query.year))
      .set('month', String(query.month));
    return this.http.delete<TargetsData>(`${this.api.apiBase}/targets`, {
      params,
      withCredentials: true,
    });
  }

  lock(query: { year: number; month: number }): Observable<TargetsData> {
    const params = new HttpParams()
      .set('year', String(query.year))
      .set('month', String(query.month));
    return this.http.post<TargetsData>(`${this.api.apiBase}/targets/lock`, null, {
      params,
      withCredentials: true,
    });
  }

  unlock(query: { year: number; month: number }): Observable<TargetsData> {
    const params = new HttpParams()
      .set('year', String(query.year))
      .set('month', String(query.month));
    return this.http.post<TargetsData>(`${this.api.apiBase}/targets/unlock`, null, {
      params,
      withCredentials: true,
    });
  }
}
