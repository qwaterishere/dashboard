import { Injectable } from '@angular/core';
import { PreloadingStrategy, Route } from '@angular/router';
import { Observable, of } from 'rxjs';

/** Подгружает все lazy-маршруты сразу после старта приложения. */
@Injectable({ providedIn: 'root' })
export class PreloadAllLazyRoutesStrategy implements PreloadingStrategy {
  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (route.loadComponent ?? route.loadChildren) {
      return load();
    }
    return of(null);
  }
}
