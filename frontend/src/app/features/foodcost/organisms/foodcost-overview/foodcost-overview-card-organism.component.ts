import { Component, input } from '@angular/core';

import { LflBadgeComponent } from '../../../../ui/atoms/lfl-badge/lfl-badge.component';
import { MoneyPipe, PctPipe } from '../../../../shared/pipes/format.pipes';
import type { FoodcostOverviewCard } from '../../../../shared/models';

@Component({
  selector: 'app-foodcost-overview-card-organism',
  standalone: true,
  imports: [LflBadgeComponent, MoneyPipe, PctPipe],
  host: { class: 'foodcost-overview-card' },
  template: `
    <div class="big-card" [class.clean]="tone() === 'clean'" [class.dirty]="tone() === 'dirty'">
      <div class="bc-head">
        <div class="bc-title">
          {{ card().title }}
          <span class="tag">{{ card().tag }}</span>
        </div>
        <app-lfl-badge
          [pct]="card().lfl.pct"
          [direction]="card().lfl.dir"
          [inverted]="true"
        />
      </div>
      <div class="bc-sub">{{ card().subtitle }}</div>
      <div class="bc-main">
        <span class="bc-pct">{{ card().pct | pct }}</span>
        <div class="bc-meta">
          <span>цель <b>{{ card().goal | pct }}</b></span>
          @if (tone() === 'clean') {
            <span>себестоимость <b>{{ card().cost | money }}</b></span>
            <span>выручка <b>{{ card().revenue! | money }}</b></span>
          } @else {
            <span>расход продуктов <b>{{ card().cost | money }}</b></span>
            <span
              >сверх продаж <b class="over-sales">+{{ card().overSales! | money }}</b></span
            >
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './foodcost-overview-card-organism.component.scss',
})
export class FoodcostOverviewCardOrganismComponent {
  readonly card = input.required<FoodcostOverviewCard>();
  readonly tone = input.required<'clean' | 'dirty'>();
}
