import { DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  catchError,
  finalize,
  of,
  Subject,
  switchMap,
  takeUntil,
  tap,
} from 'rxjs';

import type { DataFreshness } from '../../shared/models/data-freshness.model';
import { AuthService } from '../auth/auth.service';
import { API_CONFIG } from '../config/api-config.token';
import { ANALYTICS_CACHE_CONFIG } from '../config/analytics-cache.config';

/** Интервал опроса freshness, пока идёт iiko sync (синхронен с polling настроек). */
const ACTIVE_SYNC_POLL_MS = 2_000;

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
  private syncActive = false;
  private readonly refreshTrigger$ = new Subject<boolean>();
  private readonly destroyed$ = new Subject<void>();

  constructor() {
    this.refreshTrigger$
      .pipe(
        switchMap((silent) => this.fetchFreshness(silent)),
        takeUntil(this.destroyed$),
      )
      .subscribe();

    effect(() => {
      const authenticated = this.auth.isAuthenticated();
      untracked(() => {
        if (authenticated) {
          this.refresh(false);
          this.restartPolling();
          return;
        }
        this.syncActive = false;
        this.stopPolling();
        this.freshness.set(null);
        this.loadError.set(false);
      });
    });

    this.destroyRef.onDestroy(() => {
      this.stopPolling();
      this.destroyed$.next();
      this.destroyed$.complete();
    });
  }

  /** Запросить актуальную свежесть (silent — без loading-индикатора). */
  refresh(silent = true): void {
    if (!this.auth.isAuthenticated()) {
      return;
    }
    this.refreshTrigger$.next(silent);
  }

  /**
   * iiko sync стартовал (ручной или авто) — сразу обновить badge и
   * ускорить poll, пока статус running.
   */
  noteSyncStarted(): void {
    this.setSyncActive(true);
    this.refresh(true);
  }

  /** Промежуточный тик polling настроек — подтянуть progress %. */
  noteSyncProgress(): void {
    if (!this.syncActive) {
      this.setSyncActive(true);
    }
    this.refresh(true);
  }

  /** Sync завершён (success / error / noop) — вернуть обычный poll и обновить badge. */
  noteSyncFinished(): void {
    this.setSyncActive(false);
    this.refresh(true);
  }

  /** Изменились настройки iiko (подключение / автоsync) без sync job. */
  noteSettingsChanged(): void {
    this.refresh(true);
  }

  private setSyncActive(active: boolean): void {
    if (this.syncActive === active) {
      return;
    }
    this.syncActive = active;
    if (this.auth.isAuthenticated()) {
      this.restartPolling();
    }
  }

  private fetchFreshness(silent: boolean) {
    if (!silent) {
      this.loading.set(true);
      this.loadError.set(false);
    }

    return this.http
      .get<DataFreshness>(`${this.api.apiBase}/data-freshness`, { withCredentials: true })
      .pipe(
        catchError(() => {
          this.loadError.set(true);
          return of(null);
        }),
        tap((payload) => {
          if (payload !== null) {
            this.freshness.set(payload);
            this.loadError.set(false);
            this.alignSyncActiveWithPayload(payload);
          }
        }),
        finalize(() => {
          if (!silent) {
            this.loading.set(false);
          }
        }),
      );
  }

  /** Если API уже показывает running/не running — синхронизировать режим poll. */
  private alignSyncActiveWithPayload(payload: DataFreshness): void {
    const running = payload.status === 'syncing' || payload.syncStatus === 'running';
    if (running !== this.syncActive) {
      this.setSyncActive(running);
    }
  }

  private restartPolling(): void {
    this.stopPolling();
    if (!this.auth.isAuthenticated()) {
      return;
    }

    const intervalMs = this.syncActive ? ACTIVE_SYNC_POLL_MS : this.config.pollIntervalMs;
    this.pollTimer = setInterval(() => {
      if (!this.auth.isAuthenticated()) return;
      this.refresh(true);
    }, intervalMs);
  }

  private stopPolling(): void {
    if (this.pollTimer === null) return;
    clearInterval(this.pollTimer);
    this.pollTimer = null;
  }
}
