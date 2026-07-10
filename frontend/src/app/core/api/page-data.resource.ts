import { inject } from '@angular/core';
import { httpResource } from '@angular/common/http';

import { API_CONFIG } from '../config/api-config.token';
import { isAllowedPage } from './allowed-pages';
import type { PageName } from '../../shared/models';

export interface PageResourceOptions {
  query?: Record<string, string>;
}

/**
 * Типизированный httpResource для whitelist-страниц API.
 * URL строится из `API_CONFIG.apiBase` + имя страницы.
 */
export function createPageResource<T>(page: () => PageName, options?: () => PageResourceOptions) {
  const config = inject(API_CONFIG);

  return httpResource<T>(() => {
    const name = page();
    if (!isAllowedPage(name)) {
      throw new Error('Неизвестная страница');
    }
    const base = `${config.apiBase}/${name}`;
    const query = options?.().query;
    if (!query || Object.keys(query).length === 0) {
      return { url: base };
    }
    const params = new URLSearchParams(query);
    return { url: `${base}?${params.toString()}` };
  });
}
