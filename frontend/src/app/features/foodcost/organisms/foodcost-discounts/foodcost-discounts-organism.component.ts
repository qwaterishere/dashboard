import { Component, input } from '@angular/core';

import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import type { FoodcostData } from '../../../../shared/models';

@Component({
  selector: 'app-foodcost-discounts-organism',
  standalone: true,
  imports: [HeadingComponent],
  template: `
    <div class="discounts">
      <div class="losses-head">
        <app-heading [level]="2" text="Влияние скидок" />
        <span class="losses-sub"
          >скидки не меняют себестоимость, но снижают выручку и повышают фудкост</span
        >
      </div>
      <div class="disc-grid">
        @for (cell of discounts(); track cell.label) {
          <div class="disc-cell">
            <div class="dc-label">{{ cell.label }}</div>
            <div class="dc-val" [class.amber]="cell.tone === 'amber'">{{ cell.value }}</div>
            <div class="dc-cap">{{ cell.caption }}</div>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './foodcost-discounts-organism.component.scss',
})
export class FoodcostDiscountsOrganismComponent {
  readonly discounts = input.required<FoodcostData['discounts']>();
}
