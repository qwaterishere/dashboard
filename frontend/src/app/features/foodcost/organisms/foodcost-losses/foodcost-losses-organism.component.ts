import { Component, input } from '@angular/core';

import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { MoneyPipe } from '../../../../shared/pipes/format.pipes';
import type { FoodcostData } from '../../../../shared/models';

@Component({
  selector: 'app-foodcost-losses-organism',
  standalone: true,
  imports: [HeadingComponent, MoneyPipe],
  template: `
    <div class="losses">
      <div class="losses-head">
        <app-heading [level]="2" text="Расход продуктов сверх продаж" />
        <span class="losses-sub">статьи потерь · факт и цель за период</span>
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
    </div>
  `,
  styleUrl: './foodcost-losses-organism.component.scss',
})
export class FoodcostLossesOrganismComponent {
  readonly losses = input.required<FoodcostData['losses']>();
}
