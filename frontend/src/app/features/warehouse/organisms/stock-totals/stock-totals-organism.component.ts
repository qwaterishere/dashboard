import { Component, input } from '@angular/core';

import { CAT_COLOR } from '../../../../shared/constants/category.constants';
import { MoneyPipe } from '../../../../shared/pipes/format.pipes';
import type { CategoryKey, WarehouseData } from '../../../../shared/models';

@Component({
  selector: 'app-stock-totals-organism',
  standalone: true,
  imports: [MoneyPipe],
  template: `
    <div class="block total-big">
      <div class="tb-label">Общие товарные запасы</div>
      <div class="tb-val">{{ totals().value | money }}</div>
      <div class="tb-sub">в себестоимости · {{ totals().stores }} склада</div>
      <div class="tb-stores">
        @for (store of totals().byStore; track store.key) {
          <div class="store-row">
            <span class="store-dot" [style.background]="color(store.key)"></span>
            <span class="sn">{{ store.name }}</span>
            <b>{{ store.value | money }}</b>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './stock-totals-organism.component.scss',
})
export class StockTotalsOrganismComponent {
  readonly totals = input.required<WarehouseData['totals']>();

  color(key: CategoryKey): string {
    return CAT_COLOR[key];
  }
}
