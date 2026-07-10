import { ApplicationConfig, provideAppInitializer, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, RouteReuseStrategy, withPreloading } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { apiFallbackInterceptor } from './core/interceptors/api-fallback.interceptor';
import { AnalyticsRouteReuseStrategy } from './core/routing/analytics-route-reuse.strategy';
import { PreloadAllLazyRoutesStrategy } from './core/routing/preload-all-lazy-routes.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withPreloading(PreloadAllLazyRoutesStrategy)),
    { provide: RouteReuseStrategy, useClass: AnalyticsRouteReuseStrategy },
    provideHttpClient(withInterceptors([authInterceptor, apiFallbackInterceptor])),
    provideAppInitializer(() => {
      const auth = inject(AuthService);
      return firstValueFrom(auth.bootstrapSession()).then(() => undefined);
    }),
  ],
};
