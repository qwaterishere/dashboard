import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, tap, throwError } from 'rxjs';

import { API_CONFIG } from '../../../core/config/api-config.token';
import { AuthService } from '../../../core/auth/auth.service';
import { DataFreshnessService } from '../../../core/data/data-freshness.service';
import type {
  ChangePasswordRequest,
  TokenResponse,
  UpdateProfileRequest,
  UserPublic,
} from '../../../shared/models/auth.model';
import type {
  IikoSettingsPublic,
  IikoSyncStartResponse,
  UpdateIikoSettingsRequest,
} from '../../../shared/models/iiko-settings.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_CONFIG);
  private readonly auth = inject(AuthService);
  private readonly freshness = inject(DataFreshnessService);

  /** Текущий пользователь — единый источник для страницы настроек. */
  readonly user = this.auth.user;

  readonly iikoSettings = signal<IikoSettingsPublic | null>(null);
  readonly iikoSettingsLoading = signal(true);
  readonly iikoSettingsLoadError = signal(false);

  /** Предыдущий тик sync — чтобы ловить переход running → terminal. */
  private lastSyncWasRunning = false;

  updateProfile(payload: UpdateProfileRequest): Observable<UserPublic> {
    return this.http
      .patch<UserPublic>(this.url('me'), payload, { withCredentials: true })
      .pipe(tap((user) => this.auth.user.set(user)));
  }

  changePassword(payload: ChangePasswordRequest): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(this.url('change-password'), payload, {
      withCredentials: true,
    });
  }

  loadIikoSettings(): Observable<IikoSettingsPublic> {
    return this.fetchIikoSettings(false);
  }

  /** Обновление без индикатора загрузки — для polling статуса sync. */
  refreshIikoSettings(): Observable<IikoSettingsPublic> {
    return this.fetchIikoSettings(true);
  }

  private fetchIikoSettings(silent: boolean): Observable<IikoSettingsPublic> {
    if (!silent) {
      this.iikoSettingsLoading.set(true);
      this.iikoSettingsLoadError.set(false);
    }

    return this.http.get<IikoSettingsPublic>(this.url('me/iiko'), { withCredentials: true }).pipe(
      tap((settings) => {
        this.iikoSettings.set(settings);
        this.propagateSyncLifecycle(settings);
        if (!silent) {
          this.iikoSettingsLoading.set(false);
        }
      }),
      catchError((err) => {
        if (!silent) {
          this.iikoSettingsLoadError.set(true);
          this.iikoSettingsLoading.set(false);
        }
        return throwError(() => err);
      }),
    );
  }

  updateIikoSettings(payload: UpdateIikoSettingsRequest): Observable<IikoSettingsPublic> {
    return this.http
      .put<IikoSettingsPublic>(this.url('me/iiko'), payload, {
        withCredentials: true,
      })
      .pipe(
        tap((settings) => {
          this.iikoSettings.set(settings);
          this.freshness.noteSettingsChanged();
        }),
      );
  }

  syncIiko(full = false): Observable<IikoSyncStartResponse> {
    const params = full ? { full: 'true' } : undefined;
    return this.http
      .post<IikoSyncStartResponse>(this.url('me/iiko/sync'), null, {
        withCredentials: true,
        params,
      })
      .pipe(
        tap(() => {
          this.lastSyncWasRunning = true;
          this.freshness.noteSyncStarted();
        }),
      );
  }

  /**
   * Связывает статус sync из /me/iiko с badge свежести:
   * вход в running → быстрый poll; выход → немедленный refresh и обычный интервал.
   */
  private propagateSyncLifecycle(settings: IikoSettingsPublic): void {
    const running = settings.sync.status === 'running';

    if (running && !this.lastSyncWasRunning) {
      this.freshness.noteSyncStarted();
    } else if (!running && this.lastSyncWasRunning) {
      this.freshness.noteSyncFinished();
    }

    this.lastSyncWasRunning = running;
  }

  private url(path: string): string {
    return `${this.api.apiBase}/auth/${path}`;
  }
}
