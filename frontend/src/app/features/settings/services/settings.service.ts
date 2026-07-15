import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, tap, throwError } from 'rxjs';

import { API_CONFIG } from '../../../core/config/api-config.token';
import { AuthService } from '../../../core/auth/auth.service';
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

  /** Текущий пользователь — единый источник для страницы настроек. */
  readonly user = this.auth.user;

  readonly iikoSettings = signal<IikoSettingsPublic | null>(null);
  readonly iikoSettingsLoading = signal(true);
  readonly iikoSettingsLoadError = signal(false);

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
    return this.http.put<IikoSettingsPublic>(this.url('me/iiko'), payload, {
      withCredentials: true,
    }).pipe(tap((settings) => this.iikoSettings.set(settings)));
  }

  syncIiko(full = false): Observable<IikoSyncStartResponse> {
    const params = full ? { full: 'true' } : undefined;
    return this.http.post<IikoSyncStartResponse>(this.url('me/iiko/sync'), null, {
      withCredentials: true,
      params,
    });
  }

  private url(path: string): string {
    return `${this.api.apiBase}/auth/${path}`;
  }
}
