import { Component, input } from '@angular/core';

import { FoodcostOverviewCardOrganismComponent } from './foodcost-overview-card-organism.component';
import type { FoodcostData } from '../../../../shared/models';

@Component({
  selector: 'app-foodcost-overview-organism',
  standalone: true,
  imports: [FoodcostOverviewCardOrganismComponent],
  template: `
    <div class="fc-overview">
      <app-foodcost-overview-card-organism tone="clean" [card]="overview().clean" />
      <app-foodcost-overview-card-organism tone="dirty" [card]="overview().dirty" />
    </div>
  `,
  styles: `
    .fc-overview {
      display: grid;
      grid-template-columns: 1fr 1.25fr;
      gap: 16px;
      margin-bottom: 16px;
      align-items: stretch;
    }

    .fc-overview > * {
      height: 100%;
    }

    @media (max-width: 900px) {
      .fc-overview {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class FoodcostOverviewOrganismComponent {
  readonly overview = input.required<FoodcostData['overview']>();
}
