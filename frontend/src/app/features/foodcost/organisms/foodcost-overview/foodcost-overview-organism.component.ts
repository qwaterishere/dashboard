import { Component, input } from '@angular/core';

import { FoodcostOverviewCardOrganismComponent } from './foodcost-overview-card-organism.component';
import type { FoodcostData } from '../../../../shared/models';

@Component({
  selector: 'app-foodcost-overview-organism',
  standalone: true,
  imports: [FoodcostOverviewCardOrganismComponent],
  template: `
    <div class="fc-overview" [class.fc-overview--single]="!overview().dirty">
      <app-foodcost-overview-card-organism tone="clean" [card]="overview().clean" />
      @if (overview().dirty; as dirtyCard) {
        <app-foodcost-overview-card-organism tone="dirty" [card]="dirtyCard" />
      }
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

    .fc-overview--single {
      grid-template-columns: 1fr;
      max-width: 480px;
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
