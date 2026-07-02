import { httpResource } from '@angular/common/http';
import { Component, computed } from '@angular/core';

import type { SalesData } from '../../../../shared/models';
import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';
import { computeSalesRaw } from '../../data/sales-aggregation.utils';
import { SalesStructureOrganismComponent } from '../../organisms/sales-structure/sales-structure-organism.component';
import { AbcAnalysisOrganismComponent } from '../../organisms/abc-analysis/abc-analysis-organism.component';

@Component({
  selector: 'app-sales-page',
  standalone: true,
  imports: [LoadErrorComponent, SalesStructureOrganismComponent, AbcAnalysisOrganismComponent],
  host: { class: 'page-sales' },
  template: `
    @if (data.hasValue()) {
      <app-sales-structure-organism [positions]="positions()" />
      <app-abc-analysis-organism [positions]="positions()" />
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

    .loading {
      color: var(--mut2);
      font-size: 0.9rem;
    }
  `,
})
export class SalesPageComponent {
  readonly data = httpResource<SalesData>(() => ({ url: '/api/sales' }));

  readonly positions = computed(() => {
    if (!this.data.hasValue()) return [];
    return computeSalesRaw(this.data.value().positions);
  });
}
