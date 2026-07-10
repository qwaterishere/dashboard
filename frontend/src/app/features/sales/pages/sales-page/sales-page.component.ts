import { Component, inject } from '@angular/core';

import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';
import { SalesLayoutTemplateComponent } from '../../../../ui/templates/sales-layout/sales-layout-template.component';
import { SalesDataStore } from '../../data/sales-data.store';
import { SalesStructureOrganismComponent } from '../../organisms/sales-structure/sales-structure-organism.component';
import { AbcAnalysisOrganismComponent } from '../../organisms/abc-analysis/abc-analysis-organism.component';

@Component({
  selector: 'app-sales-page',
  standalone: true,
  imports: [
    LoadErrorComponent,
    SalesLayoutTemplateComponent,
    SalesStructureOrganismComponent,
    AbcAnalysisOrganismComponent,
  ],
  template: `
    <app-sales-layout-template>
      @if (data.hasValue()) {
        <app-sales-structure-organism [positions]="positions()" />
        <app-abc-analysis-organism [positions]="positions()" />
      } @else if (data.error()) {
        <app-load-error message="Не удалось загрузить данные продаж" />
      } @else {
        <p class="loading">Загрузка…</p>
      }
    </app-sales-layout-template>
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
  private readonly store = inject(SalesDataStore);

  readonly data = this.store.data;
  readonly positions = this.store.positions;
}
