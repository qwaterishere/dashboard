import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { API_CONFIG } from '../config/api-config.token';

const PUBLIC_AUTH_SUFFIXES = ['/auth/login', '/auth/register', '/auth/refresh'] as const;

function isPublicAuthRequest(url: string, apiBase: string): boolean {
  return PUBLIC_AUTH_SUFFIXES.some((suffix) => url.includes(`${apiBase}${suffix}`));
}

function isApiRequest(url: string, apiBase: string): boolean {
  return url.includes(apiBase);
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
  const outbound = isApiRequest(req.url, apiBase)
    ? req.clone({ withCredentials: true })
    : req;

  return next(outbound).pipe(
    catchError((error: HttpErrorResponse) => {
      if (!shouldAttemptRefresh(error, req.url, isPublic, auth)) {
        return throwError(() => error);
      }

      return auth.refreshAccessToken().pipe(
        switchMap(() => next(outbound)),
        catchError((refreshError) => {
          auth.handleUnauthorizedRedirect();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
