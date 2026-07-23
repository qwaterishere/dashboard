import { Component, input } from '@angular/core';

import type { FoodcostData } from '../../../../shared/models';
import { FoodcostOverviewCardOrganismComponent } from './foodcost-overview-card-organism.component';

@Component({
  selector: 'app-foodcost-overview-organism',
  standalone: true,
  imports: [FoodcostOverviewCardOrganismComponent],
  template: `
    <div class="fc-overview">
      <app-foodcost-overview-card-organism tone="clean" [card]="overview().clean" />
    </div>
  `,
  styles: `
    .fc-overview {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 16px;
      margin-bottom: 16px;
    }
  `,
})
export class FoodcostOverviewOrganismComponent {
  readonly overview = input.required<FoodcostData['overview']>();
}
