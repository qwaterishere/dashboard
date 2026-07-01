import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, switchMap } from 'rxjs';

import { API_CONFIG } from '../config/api-config.token';
import { isAllowedPage } from '../api/allowed-pages';

/** При сбое API — статический fallback data/<page>.json (как legacy api.js). */
export const apiFallbackInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api/')) {
    return next(req);
  }

  const page = req.url.split('/api/').pop()?.split('?')[0] ?? '';
  if (!isAllowedPage(page)) {
    return next(req);
  }

  const config = inject(API_CONFIG);
  const http = inject(HttpClient);

  return next(req).pipe(
    catchError(() =>
      http.get(`${config.dataFallbackBase}/${page}.json`, {
        headers: { Accept: 'application/json' },
        responseType: 'json',
      }).pipe(
        switchMap((body) => [new HttpResponse({ body, status: 200, url: req.url })]),
      ),
    ),
  );
};
