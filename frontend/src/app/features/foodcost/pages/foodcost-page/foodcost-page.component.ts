import { Component } from '@angular/core';

import { createPageResource } from '../../../../core/api/page-data.resource';
import type { FoodcostData } from '../../../../shared/models';
import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';
import { FoodcostLayoutTemplateComponent } from '../../../../ui/templates/foodcost-layout/foodcost-layout-template.component';
import { FoodcostOverviewOrganismComponent } from '../../organisms/foodcost-overview/foodcost-overview-organism.component';
import { FoodcostUnitsOrganismComponent } from '../../organisms/foodcost-units/foodcost-units-organism.component';
import { FoodcostLossesOrganismComponent } from '../../organisms/foodcost-losses/foodcost-losses-organism.component';
import { FoodcostDiscountsOrganismComponent } from '../../organisms/foodcost-discounts/foodcost-discounts-organism.component';
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
    FoodcostLossesOrganismComponent,
    FoodcostDiscountsOrganismComponent,
    FoodcostProductsChartOrganismComponent,
    FoodcostCategoriesOrganismComponent,
  ],
  template: `
    <app-foodcost-layout-template>
      @if (data.hasValue()) {
        <app-foodcost-overview-organism [overview]="data.value().overview" />
        <app-foodcost-units-organism [units]="data.value().units" />
        <app-foodcost-losses-organism [losses]="data.value().losses" />
        <app-foodcost-discounts-organism [discounts]="data.value().discounts" />
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
  readonly data = createPageResource<FoodcostData>(() => 'foodcost');
}
