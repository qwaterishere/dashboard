import { DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';

import type { DataFreshness } from '../../shared/models/data-freshness.model';
import { AuthService } from '../auth/auth.service';
import { API_CONFIG } from '../config/api-config.token';
import { ANALYTICS_CACHE_CONFIG } from '../config/analytics-cache.config';

@Injectable({ providedIn: 'root' })
export class DataFreshnessService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_CONFIG);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly config = inject(ANALYTICS_CACHE_CONFIG);

  readonly freshness = signal<DataFreshness | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal(false);

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const authenticated = this.auth.isAuthenticated();
      untracked(() => {
        if (authenticated) {
          this.refresh(false);
          this.startPolling();
          return;
        }
        this.stopPolling();
        this.freshness.set(null);
        this.loadError.set(false);
      });
    });

    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  refresh(silent = true): void {
    if (!this.auth.isAuthenticated()) {
      return;
    }

    if (!silent) {
      this.loading.set(true);
      this.loadError.set(false);
    }

    this.http
      .get<DataFreshness>(`${this.api.apiBase}/data-freshness`, { withCredentials: true })
      .pipe(
        catchError(() => {
          this.loadError.set(true);
          return of(null);
        }),
      )
      .subscribe((payload) => {
        if (payload !== null) {
          this.freshness.set(payload);
          this.loadError.set(false);
        }
        if (!silent) {
          this.loading.set(false);
        }
      });
  }

  private startPolling(): void {
    if (this.pollTimer !== null) return;

    this.pollTimer = setInterval(() => {
      if (!this.auth.isAuthenticated()) return;
      this.refresh(true);
    }, this.config.pollIntervalMs);
  }

  private stopPolling(): void {
    if (this.pollTimer === null) return;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }
}
