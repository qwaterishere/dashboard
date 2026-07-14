import { Component, input, model } from '@angular/core';

import { CAT_NAME } from '../../../../shared/constants/category.constants';
import {
  FOODCOST_SEMAPHORE_HIGH_PCT,
  FOODCOST_SEMAPHORE_LOW_PCT,
} from '../../../../shared/constants/foodcost.constants';
import { FmtPipe, MoneyPipe, PctPipe } from '../../../../shared/pipes/format.pipes';
import {
  SortableHeaderComponent,
  type SortableHeaderAlign,
} from '../../../../ui/molecules/sortable-header/sortable-header.component';
import type { AbcClass } from '../../../../shared/utils/abc-analysis.utils';
import type { SalesPositionComputed } from '../../data/sales-aggregation.utils';

export type PositionsSortKey = 'name' | 'abc' | 'qty' | 'rev' | 'gp' | 'fc';

interface PositionsColumn {
  key: PositionsSortKey;
  label: string;
  align: SortableHeaderAlign;
}

@Component({
  selector: 'app-positions-table-organism',
  standalone: true,
  imports: [FmtPipe, MoneyPipe, PctPipe, SortableHeaderComponent],
  template: `
    <table class="pos-table">
      <caption class="pos-table__caption">Позиции меню по ABC-анализу</caption>
      <colgroup>
        @for (col of columns; track col.key) {
          <col [class]="'pos-table__col pos-table__col--' + col.key" />
        }
      </colgroup>
      <thead class="pos-table__head">
        <tr>
          @for (col of columns; track col.key) {
            <th
              scope="col"
              [class]="'pos-table__th pos-table__th--' + col.key"
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
      <tbody class="pos-table__body">
        @for (row of rows(); track row.name) {
          <tr class="pos-table__row">
            <td class="pos-table__td pos-table__td--name">
              {{ row.name }}
              <small class="pos-table__sub">{{ row.sub }} · {{ categoryName(row.cat) }}</small>
            </td>
            <td class="pos-table__td pos-table__td--abc">
              <span class="abc-tag" [class]="row.abc">{{ row.abc }}</span>
            </td>
            <td class="pos-table__td pos-table__td--qty">{{ row.qty | fmt }}</td>
            <td class="pos-table__td pos-table__td--rev">{{ row.rev | money }}</td>
            <td class="pos-table__td pos-table__td--gp gp-cell">{{ row.gp | money }}</td>
            <td
              class="pos-table__td pos-table__td--fc fc-cell"
              [class.lo]="row.fc < fcLow"
              [class.hi]="row.fc > fcHigh"
            >{{ row.fc | pct }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styleUrl: './positions-table-organism.component.scss',
})
export class PositionsTableOrganismComponent {
  readonly rows = input.required<(SalesPositionComputed & { abc: AbcClass })[]>();
  readonly sortKey = model<PositionsSortKey>('gp');
  readonly sortDesc = model(true);

  protected readonly fcLow = FOODCOST_SEMAPHORE_LOW_PCT;
  protected readonly fcHigh = FOODCOST_SEMAPHORE_HIGH_PCT;

  protected readonly columns: PositionsColumn[] = [
    { key: 'name', label: 'Позиция', align: 'start' },
    { key: 'abc', label: 'ABC', align: 'center' },
    { key: 'qty', label: 'Кол-во', align: 'end' },
    { key: 'rev', label: 'Выручка', align: 'end' },
    { key: 'gp', label: 'Вал. прибыль', align: 'end' },
    { key: 'fc', label: 'Фудкост', align: 'end' },
  ];

  sortBy(key: PositionsSortKey): void {
    if (this.sortKey() === key) {
      this.sortDesc.update((value) => !value);
    } else {
      this.sortKey.set(key);
      this.sortDesc.set(key !== 'name');
    }
  }

  ariaSort(key: PositionsSortKey): 'ascending' | 'descending' | 'none' {
    if (this.sortKey() !== key) {
      return 'none';
    }
    return this.sortDesc() ? 'descending' : 'ascending';
  }

  categoryName(cat: keyof typeof CAT_NAME): string {
    return CAT_NAME[cat];
  }
}
