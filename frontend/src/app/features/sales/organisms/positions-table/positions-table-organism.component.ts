import { ScrollingModule } from '@angular/cdk/scrolling';
import { Component, input, model } from '@angular/core';

import { CAT_NAME } from '../../../../shared/constants/category.constants';
import {
  FOODCOST_SEMAPHORE_HIGH_PCT,
  FOODCOST_SEMAPHORE_LOW_PCT,
} from '../../../../shared/constants/foodcost.constants';
import { FmtPipe, PctPipe } from '../../../../shared/pipes/format.pipes';
import { formatMoney } from '../../../../shared/utils/money-format.utils';
import {
  SortableHeaderComponent,
  type SortableHeaderAlign,
} from '../../../../ui/molecules/sortable-header/sortable-header.component';
import type { AbcMeta } from '../../../../shared/utils/abc-analysis.utils';
import type { SalesPositionComputed } from '../../data/sales-aggregation.utils';

export type PositionsSortKey =
  | 'rank'
  | 'name'
  | 'abc'
  | 'qty'
  | 'rev'
  | 'gp'
  | 'fc'
  | 'share'
  | 'cumShare';

export type PositionsTableRow = SalesPositionComputed & AbcMeta;

interface PositionsColumn {
  key: PositionsSortKey;
  label: string;
  align: SortableHeaderAlign;
}

const COMPACT_MONEY_THRESHOLD = 100_000;

@Component({
  selector: 'app-positions-table-organism',
  standalone: true,
  imports: [ScrollingModule, FmtPipe, PctPipe, SortableHeaderComponent],
  template: `
    <div class="pos-table" role="table" aria-label="Позиции меню по ABC-анализу">
      <div class="pos-table__head" role="rowgroup">
        <div class="pos-table__row pos-table__row--head" role="row">
          @for (col of columns; track col.key) {
            <div
              class="pos-table__th"
              [class]="'pos-table__th pos-table__th--' + col.key"
              role="columnheader"
              [attr.aria-sort]="ariaSort(col.key)"
            >
              <app-sortable-header
                [label]="col.label"
                [align]="col.align"
                [active]="sortKey() === col.key"
                [direction]="sortDesc() ? 'desc' : 'asc'"
                (activated)="sortBy(col.key)"
              />
            </div>
          }
        </div>
      </div>

      <cdk-virtual-scroll-viewport
        class="pos-table__viewport"
        [itemSize]="rowHeight"
        [minBufferPx]="400"
        [maxBufferPx]="800"
        role="rowgroup"
      >
        <div
          *cdkVirtualFor="let row of rows(); trackBy: trackByName"
          class="pos-table__row"
          role="row"
        >
          <div class="pos-table__td pos-table__td--rank" role="cell">{{ row.rank }}</div>
          <div
            class="pos-table__td pos-table__td--name"
            role="cell"
            [attr.title]="nameTooltip(row)"
          >
            <span class="pos-table__name">{{ row.name }}</span>
            <small class="pos-table__sub">{{ row.sub }} · {{ categoryName(row.cat) }}</small>
          </div>
          <div class="pos-table__td pos-table__td--abc" role="cell">
            <span class="abc-tag" [class]="row.abc">{{ row.abc }}</span>
          </div>
          <div class="pos-table__td pos-table__td--qty" role="cell">{{ row.qty | fmt }}</div>
          <div class="pos-table__td pos-table__td--rev" role="cell">{{ formatCompactMoney(row.rev) }}</div>
          <div class="pos-table__td pos-table__td--gp gp-cell" role="cell">
            {{ hasRecipe(row) ? formatCompactMoney(row.gp) : '—' }}
          </div>
          <div
            class="pos-table__td pos-table__td--fc fc-cell"
            role="cell"
            [class.lo]="hasRecipe(row) && row.fc < fcLow"
            [class.hi]="hasRecipe(row) && row.fc > fcHigh"
          >
            {{ hasRecipe(row) ? (row.fc | pct) : '—' }}
          </div>
          <div class="pos-table__td pos-table__td--share" role="cell">{{ row.share | pct }}</div>
          <div class="pos-table__td pos-table__td--cumShare" role="cell">{{ row.cumShare | pct }}</div>
        </div>
      </cdk-virtual-scroll-viewport>
    </div>
  `,
  styleUrl: './positions-table-organism.component.scss',
})
export class PositionsTableOrganismComponent {
  readonly rows = input.required<PositionsTableRow[]>();
  readonly sortKey = model<PositionsSortKey>('gp');
  readonly sortDesc = model(true);

  protected readonly fcLow = FOODCOST_SEMAPHORE_LOW_PCT;
  protected readonly fcHigh = FOODCOST_SEMAPHORE_HIGH_PCT;
  protected readonly rowHeight = 40;

  protected readonly columns: PositionsColumn[] = [
    { key: 'rank', label: '#', align: 'end' },
    { key: 'name', label: 'Позиция', align: 'start' },
    { key: 'abc', label: 'ABC', align: 'center' },
    { key: 'qty', label: 'Кол-во', align: 'end' },
    { key: 'rev', label: 'Выручка', align: 'end' },
    { key: 'gp', label: 'Вал. прибыль', align: 'end' },
    { key: 'fc', label: 'Фудкост', align: 'end' },
    { key: 'share', label: 'Доля', align: 'end' },
    { key: 'cumShare', label: 'Кумул.', align: 'end' },
  ];

  trackByName = (_index: number, row: PositionsTableRow): string => row.name;

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

  nameTooltip(row: PositionsTableRow): string {
    return `${row.name} · ${row.sub} · ${this.categoryName(row.cat)}`;
  }

  hasRecipe(row: PositionsTableRow): boolean {
    return row.cost > 0;
  }

  formatCompactMoney(n: number): string {
    if (Math.abs(n) >= COMPACT_MONEY_THRESHOLD) {
      return `${(n / 1e6).toFixed(1).replace('.', ',')} млн`;
    }
    return formatMoney(n);
  }
}
