import { Component, input, model } from '@angular/core';

import { CAT_NAME } from '../../../../shared/constants/category.constants';
import { FmtPipe, MoneyPipe, PctPipe } from '../../../../shared/pipes/format.pipes';
import type { AbcClass } from '../../../../shared/utils/abc-analysis.utils';
import type { SalesPositionComputed } from '../../data/sales-aggregation.utils';

export type PositionsSortKey = 'name' | 'abc' | 'qty' | 'rev' | 'gp' | 'fc';

@Component({
  selector: 'app-positions-table-organism',
  standalone: true,
  imports: [FmtPipe, MoneyPipe, PctPipe],
  template: `
    <table class="pos-table">
      <thead>
        <tr>
          @for (col of columns; track col.key) {
            <th
              [class.num]="col.key !== 'name'"
              [class.sorted]="sortKey() === col.key"
              (click)="sortBy(col.key)"
            >
              {{ col.label }}
              <span class="arr">{{ sortKey() === col.key ? (sortDesc() ? '▾' : '▴') : '▾' }}</span>
            </th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.name) {
          <tr>
            <td class="pos-name">
              {{ row.name }}
              <small>{{ row.sub }} · {{ categoryName(row.cat) }}</small>
            </td>
            <td><span class="abc-tag" [class]="row.abc">{{ row.abc }}</span></td>
            <td>{{ row.qty | fmt }}</td>
            <td>{{ row.rev | money }}</td>
            <td class="gp-cell">{{ row.gp | money }}</td>
            <td class="fc-cell" [class.lo]="row.fc < 28" [class.hi]="row.fc > 33">{{ row.fc | pct }}</td>
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

  protected readonly columns: { key: PositionsSortKey; label: string }[] = [
    { key: 'name', label: 'Позиция' },
    { key: 'abc', label: 'ABC' },
    { key: 'qty', label: 'Кол-во' },
    { key: 'rev', label: 'Выручка' },
    { key: 'gp', label: 'Вал. прибыль' },
    { key: 'fc', label: 'Фудкост' },
  ];

  sortBy(key: PositionsSortKey): void {
    if (this.sortKey() === key) {
      this.sortDesc.update((value) => !value);
    } else {
      this.sortKey.set(key);
      this.sortDesc.set(key !== 'name');
    }
  }

  categoryName(cat: keyof typeof CAT_NAME): string {
    return CAT_NAME[cat];
  }
}
