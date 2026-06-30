import { httpResource } from '@angular/common/http';
import { Component } from '@angular/core';

import type { FoodcostData } from '../../../../shared/models';
import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';

@Component({
  selector: 'app-foodcost-page',
  standalone: true,
  host: { '[attr.data-page]': '"foodcost"' },
  imports: [LoadErrorComponent],
  template: `
    @if (data.hasValue()) {
      <p class="stub">UI — Фаза 5</p>
    } @else if (data.error()) {
      <app-load-error message="Не удалось загрузить данные фудкоста" />
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
export class FoodcostPageComponent {
  readonly data = httpResource<FoodcostData>(() => ({ url: '/api/foodcost' }));
}
