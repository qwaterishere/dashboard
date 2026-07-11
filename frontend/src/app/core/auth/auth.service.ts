import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap, throwError } from 'rxjs';

import { API_CONFIG } from '../config/api-config.token';
import { DashboardCache } from '../data/dashboard-cache.service';
import type { LoginRequest, RegisterRequest, TokenResponse, UserPublic } from '../../shared/models/auth.model';

const AUTH_PREFIX = '/auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly api = inject(API_CONFIG);
  private readonly router = inject(Router);
  private readonly dashboardCache = inject(DashboardCache);

  readonly user = signal<UserPublic | null>(null);

  readonly isAuthenticated = computed(() => this.user() !== null);

  /** Сессия уже восстанавливалась (app init) — повторный silent refresh не нужен. */
  private readonly sessionBootstrapped = signal(false);
  /** После явного logout не дергаем /refresh до нового login/register. */
  private readonly allowSilentRefresh = signal(true);

  private refreshInFlight: Observable<TokenResponse> | null = null;

  /** Разрешён ли автоматический refresh (не после явного logout). */
  canAttemptSilentRefresh(): boolean {
    return this.allowSilentRefresh();
  }

  /** Восстановление сессии по httpOnly cookies — только при старте приложения. */
  bootstrapSession(): Observable<boolean> {
    if (this.sessionBootstrapped()) {
      return of(this.isAuthenticated());
    }
    if (this.isAuthenticated()) {
      this.sessionBootstrapped.set(true);
      return of(true);
    }
    if (!this.allowSilentRefresh()) {
      this.sessionBootstrapped.set(true);
      return of(false);
    }

    return this.refreshAccessToken().pipe(
      switchMap(() => this.loadMe()),
      map(() => true),
      catchError(() => of(false)),
      finalize(() => this.sessionBootstrapped.set(true)),
    );
  }

  login(payload: LoginRequest): Observable<UserPublic> {
    return this.http
      .post<TokenResponse>(this.authUrl('login'), payload, { withCredentials: true })
      .pipe(switchMap(() => this.establishSession()));
  }

  register(payload: RegisterRequest): Observable<UserPublic> {
    return this.http
      .post<TokenResponse>(this.authUrl('register'), payload, { withCredentials: true })
      .pipe(switchMap(() => this.establishSession()));
  }

  refreshAccessToken(): Observable<TokenResponse> {
    if (!this.allowSilentRefresh()) {
      return throwError(() => new Error('Silent refresh is disabled'));
    }
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    this.refreshInFlight = this.http
      .post<TokenResponse>(this.authUrl('refresh'), {}, { withCredentials: true })
      .pipe(
        catchError((err: unknown) => {
          if (this.isAuthFailure(err)) {
            this.clearSession();
          }
          return throwError(() => err);
        }),
        finalize(() => {
          this.refreshInFlight = null;
        }),
        shareReplay(1),
      );
    return this.refreshInFlight;
  }

  loadMe(): Observable<UserPublic> {
    return this.http.get<UserPublic>(this.authUrl('me'), { withCredentials: true }).pipe(
      tap((user) => this.user.set(user)),
      catchError((err: HttpErrorResponse) => {
        if (this.isAuthFailure(err)) {
          this.clearSession();
        }
        return throwError(() => err);
      }),
    );
  }

  logout(): Observable<void> {
    return this.http.post<void>(this.authUrl('logout'), {}, { withCredentials: true }).pipe(
      tap(() => this.clearSession()),
      catchError(() => {
        this.clearSession();
        return of(undefined);
      }),
      map(() => undefined),
    );
  }

  logoutAndRedirect(): void {
    this.logout().subscribe(() => {
      void this.router.navigate(['/auth/login']);
    });
  }

  /** Редирект на login после истечения сессии (вызывается interceptor'ом). */
  handleUnauthorizedRedirect(): void {
    if (!this.router.url.startsWith('/auth')) {
      void this.router.navigate(['/auth/login'], {
        queryParams: { reason: 'session_expired' },
      });
    }
  }

  clearSession(): void {
    this.dashboardCache.clearAll();
    this.user.set(null);
    this.allowSilentRefresh.set(false);
  }

  private establishSession(): Observable<UserPublic> {
    this.allowSilentRefresh.set(true);
    this.sessionBootstrapped.set(true);
    return this.loadMe();
  }

  private isAuthFailure(err: unknown): boolean {
    return err instanceof HttpErrorResponse && (err.status === 401 || err.status === 403);
  }

  displayName(): string {
    const user = this.user();
    if (!user) return '';
    return `${user.first_name} ${user.last_name}`.trim();
  }

  initials(): string {
    const user = this.user();
    if (!user) return '';
    const first = user.first_name.charAt(0);
    const last = user.last_name.charAt(0);
    return `${first}${last}`.toUpperCase();
  }

  private authUrl(path: string): string {
    return `${this.api.apiBase}${AUTH_PREFIX}/${path}`;
  }
}
