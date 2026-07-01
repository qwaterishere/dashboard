import { httpResource } from '@angular/common/http';
import { Component } from '@angular/core';

import type { SalesData } from '../../../../shared/models';
import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';

@Component({
  selector: 'app-sales-page',
  standalone: true,
  imports: [LoadErrorComponent],
  template: `
    @if (data.hasValue()) {
      @let d = data.value();
      <p class="stub">{{ d.positions.length }} позиций · UI — Фаза 4</p>
    } @else if (data.error()) {
      <app-load-error message="Не удалось загрузить данные продаж" />
    } @else {
      <p class="loading">Загрузка…</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .stub,
    .loading {
      color: var(--mut2);
    }
  `,
})
export class SalesPageComponent {
  readonly data = httpResource<SalesData>(() => ({ url: '/api/sales' }));
}
