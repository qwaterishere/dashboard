import { HttpBackend, HttpClient, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { isAllowedPage } from '../api/allowed-pages';

function extractPageName(url: string): string | null {
  const match = url.match(/\/api\/([^/?]+)/);
  return match?.[1] ?? null;
}

function shouldFallback(status: number | undefined): boolean {
  return status === 0 || status === 502 || status === 503 || status === 504;
}

/** При недоступности API — fallback на статический JSON `/data/{page}.json`. */
export const apiFallbackInterceptor: HttpInterceptorFn = (req, next) => {
  const page = extractPageName(req.url);
  if (!page || !isAllowedPage(page) || req.method !== 'GET') {
    return next(req);
  }

  const fallbackClient = new HttpClient(inject(HttpBackend));

  return next(req).pipe(
    catchError((err: { status?: number }) => {
      if (!shouldFallback(err.status)) {
        return throwError(() => err);
      }
      return fallbackClient.request(req.clone({ url: `/data/${page}.json` }));
    }),
  );
};
