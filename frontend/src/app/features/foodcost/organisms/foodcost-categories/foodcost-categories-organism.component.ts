import { Component, computed, input, model } from '@angular/core';

import { CAT_NAME } from '../../../../shared/constants/category.constants';
import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { MoneyPipe, PctPipe, SignedPctPipe } from '../../../../shared/pipes/format.pipes';
import type { CategoryKey, FoodcostCategoryRow } from '../../../../shared/models';

@Component({
  selector: 'app-foodcost-categories-organism',
  standalone: true,
  imports: [HeadingComponent, MoneyPipe, PctPipe, SignedPctPipe],
  template: `
    <div class="catfc">
      <div class="catfc-head">
        <app-heading [level]="2" text="Фудкост по категориям" />
        <div class="catfc-tabs" role="tablist" aria-label="Подразделение">
          @for (tab of tabs; track tab.key) {
            <button
              type="button"
              class="ct-tab"
              role="tab"
              [class.on]="unit() === tab.key"
              [attr.aria-selected]="unit() === tab.key"
              [attr.data-unit]="tab.key"
              (click)="unit.set(tab.key)"
            >
              {{ tab.label }}
            </button>
          }
        </div>
      </div>
      <table class="loss-table cat-table">
        <thead>
          <tr>
            <th>Категория</th>
            <th class="num">Фудкост</th>
            <th class="num">Цель</th>
            <th class="num">Откл.</th>
            <th class="num">Себестоимость</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.name) {
            <tr>
              <td><span class="lt-name">{{ row.name }}</span></td>
              <td class="num fc-pct" [class.over]="row.fact > row.goal">{{ row.fact | pct }}</td>
              <td class="num goal">{{ row.goal | pct }}</td>
              <td class="num" [class.bad]="row.fact > row.goal" [class.ok]="row.fact <= row.goal">
                {{ deviation(row) | signedPct }}
              </td>
              <td class="num">{{ row.cost | money }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styleUrl: './foodcost-categories-organism.component.scss',
})
export class FoodcostCategoriesOrganismComponent {
  readonly categories = input.required<Record<CategoryKey, FoodcostCategoryRow[]>>();

  readonly unit = model<CategoryKey>('k');

  protected readonly tabs = (['k', 'b', 'w'] as CategoryKey[]).map((key) => ({
    key,
    label: CAT_NAME[key],
  }));

  protected readonly rows = computed(() => this.categories()[this.unit()]);

  deviation(row: FoodcostCategoryRow): number {
    if (!(row.goal > 0) || !Number.isFinite(row.fact) || !Number.isFinite(row.goal)) {
      return 0;
    }
    const value = ((row.fact - row.goal) / row.goal) * 100;
    return Number.isFinite(value) ? value : 0;
  }
}
