import { httpResource } from '@angular/common/http';
import { Component } from '@angular/core';

import type { WarehouseData } from '../../../../shared/models';
import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';

@Component({
  selector: 'app-warehouse-page',
  standalone: true,
  imports: [LoadErrorComponent],
  template: `
    @if (data.hasValue()) {
      <p class="stub">UI — Фаза 5</p>
    } @else if (data.error()) {
      <app-load-error message="Не удалось загрузить данные склада" />
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
export class WarehousePageComponent {
  readonly data = httpResource<WarehouseData>(() => ({ url: '/api/warehouse' }));
}
