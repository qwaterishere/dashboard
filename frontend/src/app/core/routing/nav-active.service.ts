import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';

/** Первый сегмент пути из router.url: `/sales` → `sales`. */
export function readPrimaryNavSegment(url: string): string {
  const head = url.split('?')[0].replace(/^\//, '');
  return head.split('/').filter(Boolean)[0] ?? '';
}

@Injectable({ providedIn: 'root' })
export class NavActiveService {
  private readonly router = inject(Router);

  readonly segment = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => readPrimaryNavSegment(this.router.url)),
      startWith(readPrimaryNavSegment(this.router.url)),
    ),
  );
}
