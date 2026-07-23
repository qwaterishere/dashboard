import { Component, inject } from '@angular/core';

import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';
import { FoodcostLayoutTemplateComponent } from '../../../../ui/templates/foodcost-layout/foodcost-layout-template.component';
import { FoodcostDataStore } from '../../data/foodcost-data.store';
import { FoodcostOverviewOrganismComponent } from '../../organisms/foodcost-overview/foodcost-overview-organism.component';
import { FoodcostUnitsOrganismComponent } from '../../organisms/foodcost-units/foodcost-units-organism.component';
import { FoodcostCombinedOrganismComponent } from '../../organisms/foodcost-combined/foodcost-combined-organism.component';
import { FoodcostProductsChartOrganismComponent } from '../../organisms/foodcost-products-chart/foodcost-products-chart-organism.component';
import { FoodcostCategoriesOrganismComponent } from '../../organisms/foodcost-categories/foodcost-categories-organism.component';

@Component({
  selector: 'app-foodcost-page',
  standalone: true,
  imports: [
    LoadErrorComponent,
    FoodcostLayoutTemplateComponent,
    FoodcostOverviewOrganismComponent,
    FoodcostUnitsOrganismComponent,
    FoodcostCombinedOrganismComponent,
    FoodcostProductsChartOrganismComponent,
    FoodcostCategoriesOrganismComponent,
  ],
  template: `
    <app-foodcost-layout-template>
      @if (data.hasValue()) {
        <app-foodcost-overview-organism [overview]="data.value().overview" />
        <app-foodcost-units-organism [units]="data.value().units" />
        <app-foodcost-combined-organism
          [dirty]="data.value().overview.dirty"
          [losses]="data.value().losses"
          [discounts]="data.value().discounts"
        />
        <app-foodcost-products-chart-organism [products]="data.value().products" />
        <app-foodcost-categories-organism [categories]="data.value().categories" />
      } @else if (data.error()) {
        <app-load-error message="Не удалось загрузить данные фудкоста" />
      } @else {
        <p class="loading">Загрузка…</p>
      }
    </app-foodcost-layout-template>
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
export class FoodcostPageComponent {
  private readonly store = inject(FoodcostDataStore);
  readonly data = this.store.data;
}
