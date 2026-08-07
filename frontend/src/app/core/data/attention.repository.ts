import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_CONFIG } from '../config/api-config.token';
import type { AttentionApi } from '../../shared/models/attention.model';

@Injectable({ providedIn: 'root' })
export class AttentionRepository {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_CONFIG);

  fetch(): Observable<AttentionApi> {
    return this.http.get<AttentionApi>(`${this.api.apiBase}/attention`, {
      withCredentials: true,
    });
  }
}
