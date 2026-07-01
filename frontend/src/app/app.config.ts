import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withPreloading } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { apiFallbackInterceptor } from './core/interceptors/api-fallback.interceptor';
import { PreloadAllLazyRoutesStrategy } from './core/routing/preload-all-lazy-routes.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withPreloading(PreloadAllLazyRoutesStrategy)),
    provideHttpClient(withInterceptors([apiFallbackInterceptor])),
  ],
};
