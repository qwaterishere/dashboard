import { Component, input } from '@angular/core';

import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { LflBadgeComponent } from '../../../../ui/atoms/lfl-badge/lfl-badge.component';
import { MoneyPipe, PctPipe } from '../../../../shared/pipes/format.pipes';
import type { FoodcostData, FoodcostOverviewCard } from '../../../../shared/models';

@Component({
  selector: 'app-foodcost-combined-organism',
  standalone: true,
  imports: [HeadingComponent, LflBadgeComponent, MoneyPipe, PctPipe],
  template: `
    <div class="fc-combined">
      <div class="fc-combined__hero">
        <div class="bc-head">
          <div class="bc-title">
            {{ dirty().title }}
            <span class="tag">{{ dirty().tag }}</span>
          </div>
          <app-lfl-badge
            [pct]="dirty().lfl.pct"
            [direction]="dirty().lfl.dir"
            [inverted]="true"
          />
        </div>
        <div class="bc-sub">{{ dirty().subtitle }}</div>
        <div class="bc-main">
          <span class="bc-pct">{{ dirty().pct | pct }}</span>
          <div class="bc-meta">
            <span>цель <b>{{ dirty().goal | pct }}</b></span>
          </div>
        </div>
      </div>

      <section class="fc-combined__section" aria-label="Влияние скидок">
        <div class="fc-combined__section-head">
          <app-heading [level]="3" text="Влияние скидок" />
          <span class="fc-combined__section-sub"
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
      </section>

      <section class="fc-combined__section" aria-label="Расход продуктов сверх продаж">
        <div class="fc-combined__section-head">
          <app-heading [level]="3" text="Расход продуктов сверх продаж" />
          <span class="fc-combined__section-sub">статьи потерь · факт и цель за период</span>
        </div>
        <table class="loss-table">
          <thead>
            <tr>
              <th>Статья</th>
              <th class="num">Факт</th>
              <th class="num">Цель</th>
            </tr>
          </thead>
          <tbody>
            @for (row of losses().rows; track row.name) {
              <tr>
                <td>
                  <span class="lt-name">{{ row.name }}</span>
                  <small>{{ row.note }}</small>
                </td>
                <td class="num">{{ row.fact | money }}</td>
                <td class="num goal">{{ row.goal | money }}</td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <td><span class="lt-name">Итого</span></td>
              <td class="num">{{ losses().total.fact | money }}</td>
              <td class="num goal">{{ losses().total.goal | money }}</td>
            </tr>
          </tfoot>
        </table>
      </section>
    </div>
  `,
  styleUrl: './foodcost-combined-organism.component.scss',
})
export class FoodcostCombinedOrganismComponent {
  readonly dirty = input.required<FoodcostOverviewCard>();
  readonly losses = input.required<FoodcostData['losses']>();
  readonly discounts = input.required<FoodcostData['discounts']>();
}
