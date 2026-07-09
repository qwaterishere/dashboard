import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { API_CONFIG } from '../config/api-config.token';

const PUBLIC_AUTH_SUFFIXES = ['/auth/login', '/auth/register', '/auth/refresh'] as const;
const CREDENTIALS_AUTH_SUFFIXES = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/logout',
] as const;

function isPublicAuthRequest(url: string, apiBase: string): boolean {
  return PUBLIC_AUTH_SUFFIXES.some((suffix) => url.includes(`${apiBase}${suffix}`));
}

function needsAuthCredentials(url: string, apiBase: string): boolean {
  return CREDENTIALS_AUTH_SUFFIXES.some((suffix) => url.includes(`${apiBase}${suffix}`));
}

function withBearer(url: string, token: string, req: Parameters<HttpInterceptorFn>[0]) {
  return req.clone({
    url,
    setHeaders: { Authorization: `Bearer ${token}` },
  });
}

function shouldAttemptRefresh(
  error: HttpErrorResponse,
  reqUrl: string,
  isPublic: boolean,
  auth: AuthService,
): boolean {
  return (
    error.status === 401 &&
    !isPublic &&
    !reqUrl.includes('/auth/refresh') &&
    !reqUrl.includes('/auth/logout') &&
    auth.canAttemptSilentRefresh()
  );
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const apiBase = inject(API_CONFIG).apiBase;

  const isPublic = isPublicAuthRequest(req.url, apiBase);
  const withCredentials = needsAuthCredentials(req.url, apiBase);

  let outbound = req;
  if (withCredentials) {
    outbound = req.clone({ withCredentials: true });
  }

  const token = auth.getAccessToken();
  if (token && !isPublic) {
    outbound = withBearer(outbound.url, token, outbound);
  }

  return next(outbound).pipe(
    catchError((error: HttpErrorResponse) => {
      if (!shouldAttemptRefresh(error, req.url, isPublic, auth)) {
        return throwError(() => error);
      }

      return auth.refreshAccessToken().pipe(
        switchMap(() => {
          const refreshedToken = auth.getAccessToken();
          if (!refreshedToken) {
            return throwError(() => error);
          }
          return next(withBearer(req.url, refreshedToken, req));
        }),
        catchError((refreshError) => {
          auth.handleUnauthorizedRedirect();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
