import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface ApiConfig {
  apiBase: string;
  dataFallbackBase: string;
}

export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG', {
  providedIn: 'root',
  factory: () => ({
    apiBase: environment.apiBase,
    dataFallbackBase: environment.dataFallbackBase,
  }),
});
