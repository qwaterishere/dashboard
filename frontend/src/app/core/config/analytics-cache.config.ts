import { InjectionToken } from '@angular/core';

import { environment } from '../../../environments/environment';

export interface AnalyticsCacheConfig {
  /** После этого интервала данные считаются устаревшими. */
  staleAfterMs: number;
  /** Интервал фонового опроса на аналитических страницах. */
  pollIntervalMs: number;
}

export const ANALYTICS_CACHE_CONFIG = new InjectionToken<AnalyticsCacheConfig>(
  'ANALYTICS_CACHE_CONFIG',
  {
    factory: () => environment.analytics,
  },
);
