import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { API_CONFIG } from '../../../core/config/api-config.token';
import { AuthService } from '../../../core/auth/auth.service';
import type {
  ChangePasswordRequest,
  TokenResponse,
  UpdateProfileRequest,
  UserPublic,
} from '../../../shared/models/auth.model';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_CONFIG);
  private readonly auth = inject(AuthService);

  /** Текущий пользователь — единый источник для страницы настроек. */
  readonly user = this.auth.user;

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

  private url(path: string): string {
    return `${this.api.apiBase}/auth/${path}`;
  }
}
