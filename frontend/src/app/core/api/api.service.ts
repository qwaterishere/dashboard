import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_CONFIG } from '../config/api-config.token';
import { isAllowedPage } from './allowed-pages';
import type { PageName } from '../../shared/models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(API_CONFIG);

  /** Загрузить данные страницы через whitelist API. */
  fetchPage<T>(page: PageName): Promise<T> {
    if (!isAllowedPage(page)) {
      return Promise.reject(new Error('Неизвестная страница'));
    }
    return firstValueFrom(
      this.http.get<T>(`${this.config.apiBase}/${page}`, {
        headers: { Accept: 'application/json' },
      }),
    );
  }
}
