import { Component, input } from '@angular/core';

import { LflBadgeComponent } from '../../../../ui/atoms/lfl-badge/lfl-badge.component';
import { MoneyPipe, PctPipe, SignedPctPipe } from '../../../../shared/pipes/format.pipes';
import type { FoodcostUnit } from '../../../../shared/models';

@Component({
  selector: 'app-foodcost-units-organism',
  standalone: true,
  imports: [LflBadgeComponent, MoneyPipe, PctPipe, SignedPctPipe],
  template: `
    <div class="units">
      @for (unit of units(); track unit.key) {
        <div class="unit" [class]="unit.key">
          <div class="u-head">
            <span class="u-name">{{ unit.name }}</span>
            <app-lfl-badge
              [pct]="unit.lfl.pct"
              [direction]="unit.lfl.dir"
              [inverted]="true"
            />
          </div>
          <div class="u-pct">
            <span class="v">{{ unit.pct | pct }}</span>
          </div>
          <div class="u-rows">
            <div class="u-row">
              <span>Цель</span>
              <b
                >{{ unit.goal | pct }} ·
                <span [class]="unit.pct > unit.goal ? 'goal-bad' : 'goal-ok'">{{
                  deviation(unit) | signedPct
                }}</span></b
              >
            </div>
            <div class="u-row">
              <span>Себестоимость</span>
              <b>{{ unit.cost | money }}</b>
            </div>
            <div class="u-row">
              <span>Доля в расходе</span>
              <b>{{ unit.shareOfSpend | pct }}</b>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './foodcost-units-organism.component.scss',
})
export class FoodcostUnitsOrganismComponent {
  readonly units = input.required<FoodcostUnit[]>();

  deviation(unit: FoodcostUnit): number {
    return ((unit.pct - unit.goal) / unit.goal) * 100;
  }
}
