import { Component, computed, input, model, signal } from '@angular/core';

import { CAT_NAME } from '../../../../shared/constants/category.constants';
import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { MoneyPipe, PctPipe, SignedPpPipe } from '../../../../shared/pipes/format.pipes';
import {
  SortableHeaderComponent,
  type SortableHeaderAlign,
} from '../../../../ui/molecules/sortable-header/sortable-header.component';
import type { CategoryKey, FoodcostCategoryRow } from '../../../../shared/models';

type CatSortKey = 'name' | 'fact' | 'deviation' | 'cost';

interface CatColumn {
  key: CatSortKey;
  label: string;
  align: SortableHeaderAlign;
}

@Component({
  selector: 'app-foodcost-categories-organism',
  standalone: true,
  imports: [HeadingComponent, MoneyPipe, PctPipe, SignedPpPipe, SortableHeaderComponent],
  template: `
    <div class="catfc">
      <div class="catfc-head">
        <div class="catfc-title">
          <app-heading [level]="2" text="Фудкост по категориям" />
          <span class="catfc-goal">
            цель <b>{{ unitGoal() | pct }}</b>
          </span>
        </div>
        <div class="catfc-tabs" role="tablist" aria-label="Подразделение">
          @for (tab of tabs; track tab.key) {
            <button
              type="button"
              class="ct-tab"
              role="tab"
              [class.on]="unit() === tab.key"
              [attr.aria-selected]="unit() === tab.key"
              [attr.data-unit]="tab.key"
              (click)="selectUnit(tab.key)"
            >
              {{ tab.label }}
            </button>
          }
        </div>
      </div>
      <table class="loss-table cat-table">
        <thead>
          <tr>
            @for (col of columns; track col.key) {
              <th
                scope="col"
                [class.num]="col.align === 'end'"
                [attr.aria-sort]="ariaSort(col.key)"
              >
                <app-sortable-header
                  [label]="col.label"
                  [align]="col.align"
                  [active]="sortKey() === col.key"
                  [direction]="sortDesc() ? 'desc' : 'asc'"
                  (activated)="sortBy(col.key)"
                />
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of sortedRows(); track row.name) {
            <tr>
              <td><span class="lt-name">{{ row.name }}</span></td>
              <td class="num fc-pct" [class.over]="row.fact > unitGoal()">{{ row.fact | pct }}</td>
              <td
                class="num"
                [class.bad]="row.fact > unitGoal()"
                [class.ok]="row.fact <= unitGoal()"
              >
                {{ deviation(row) | signedPp }}
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
  readonly sortKey = signal<CatSortKey>('fact');
  readonly sortDesc = signal(true);

  protected readonly tabs = (['k', 'b', 'w'] as CategoryKey[]).map((key) => ({
    key,
    label: CAT_NAME[key],
  }));

  protected readonly columns: CatColumn[] = [
    { key: 'name', label: 'Категория', align: 'start' },
    { key: 'fact', label: 'Фудкост', align: 'end' },
    { key: 'deviation', label: 'Откл.', align: 'end' },
    { key: 'cost', label: 'Себестоимость', align: 'end' },
  ];

  protected readonly unitGoal = computed(() => {
    const rows = this.categories()[this.unit()] ?? [];
    const goal = rows[0]?.goal;
    return Number.isFinite(goal) ? (goal as number) : 0;
  });

  protected readonly sortedRows = computed(() => {
    const list = [...(this.categories()[this.unit()] ?? [])];
    const key = this.sortKey();
    const desc = this.sortDesc();
    const goal = this.unitGoal();

    list.sort((a, b) => {
      let cmp = 0;
      switch (key) {
        case 'name':
          cmp = a.name.localeCompare(b.name, 'ru');
          break;
        case 'fact':
          cmp = a.fact - b.fact;
          break;
        case 'deviation':
          cmp = this.deviationOf(a, goal) - this.deviationOf(b, goal);
          break;
        case 'cost':
          cmp = a.cost - b.cost;
          break;
      }
      return desc ? -cmp : cmp;
    });

    return list;
  });

  selectUnit(key: CategoryKey): void {
    this.unit.set(key);
  }

  sortBy(key: CatSortKey): void {
    if (this.sortKey() === key) {
      this.sortDesc.update((value) => !value);
    } else {
      this.sortKey.set(key);
      this.sortDesc.set(key !== 'name');
    }
  }

  ariaSort(key: CatSortKey): 'ascending' | 'descending' | 'none' {
    if (this.sortKey() !== key) return 'none';
    return this.sortDesc() ? 'descending' : 'ascending';
  }

  deviation(row: FoodcostCategoryRow): number {
    return this.deviationOf(row, this.unitGoal());
  }

  private deviationOf(row: FoodcostCategoryRow, goal: number): number {
    if (!Number.isFinite(row.fact) || !Number.isFinite(goal)) return 0;
    const value = goal - row.fact;
    return Number.isFinite(value) ? value : 0;
  }
}
