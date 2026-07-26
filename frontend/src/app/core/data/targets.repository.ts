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

  private monthUrl(year: number, month: number): string {
    return `${this.api.apiBase}/targets/${year}/${month}`;
  }

  fetch(query: TargetsQuery = {}): Observable<TargetsData> {
    if (query.year != null && query.month != null) {
      return this.http.get<TargetsData>(this.monthUrl(query.year, query.month), {
        withCredentials: true,
      });
    }
    return this.http.get<TargetsData>(`${this.api.apiBase}/targets`, {
      withCredentials: true,
    });
  }

  listLocks(): Observable<TargetsLockedList> {
    return this.http.get<TargetsLockedList>(`${this.api.apiBase}/targets`, {
      params: new HttpParams().set('status', 'locked'),
      withCredentials: true,
    });
  }

  listConfigured(): Observable<TargetsLockedList> {
    return this.http.get<TargetsLockedList>(`${this.api.apiBase}/targets`, {
      params: new HttpParams().set('status', 'configured'),
      withCredentials: true,
    });
  }

  save(payload: TargetsUpsertRequest): Observable<TargetsData> {
    return this.http.put<TargetsData>(
      this.monthUrl(payload.year, payload.month),
      payload,
      { withCredentials: true },
    );
  }

  clear(query: { year: number; month: number }): Observable<TargetsData> {
    return this.http.delete<TargetsData>(this.monthUrl(query.year, query.month), {
      withCredentials: true,
    });
  }

  lock(query: { year: number; month: number }): Observable<TargetsData> {
    return this.http.post<TargetsData>(
      `${this.monthUrl(query.year, query.month)}/lock`,
      null,
      { withCredentials: true },
    );
  }

  unlock(query: { year: number; month: number }): Observable<TargetsData> {
    return this.http.delete<TargetsData>(
      `${this.monthUrl(query.year, query.month)}/lock`,
      { withCredentials: true },
    );
  }
}
