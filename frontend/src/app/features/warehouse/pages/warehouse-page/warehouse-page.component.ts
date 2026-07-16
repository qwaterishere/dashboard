import { Component, computed, inject } from '@angular/core';

import { WarehouseDataStore } from '../../data/warehouse-data.store';
import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';
import { WarehouseLayoutTemplateComponent } from '../../../../ui/templates/warehouse-layout/warehouse-layout-template.component';
import { computeWarehouseStock } from '../../data/warehouse-aggregation.utils';
import { StockTotalsOrganismComponent } from '../../organisms/stock-totals/stock-totals-organism.component';
import { WarehouseCategoriesOrganismComponent } from '../../organisms/warehouse-categories/warehouse-categories-organism.component';
import { StockDynamicsOrganismComponent } from '../../organisms/stock-dynamics/stock-dynamics-organism.component';
import { TopPositionsOrganismComponent } from '../../organisms/top-positions/top-positions-organism.component';
import { MoneyPipe } from '../../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-warehouse-page',
  standalone: true,
  imports: [
    LoadErrorComponent,
    WarehouseLayoutTemplateComponent,
    StockTotalsOrganismComponent,
    WarehouseCategoriesOrganismComponent,
    StockDynamicsOrganismComponent,
    TopPositionsOrganismComponent,
    MoneyPipe,
  ],
  template: `
    <app-warehouse-layout-template>
      @if (data.hasValue()) {
        <p class="as-of">На {{ data.value().asOf.label }} · {{ data.value().asOf.note }}</p>

        @if (data.value().negativeStock.count > 0) {
          <div class="neg-banner" role="status">
            Минусовые остатки: {{ data.value().negativeStock.count }} поз. · дыра
            {{ data.value().negativeStock.valueAbs | money }}
          </div>
        }

        <div class="row2">
          <app-stock-totals-organism [totals]="data.value().totals" />
          <app-warehouse-categories-organism [stock]="stock()" />
        </div>
        <app-stock-dynamics-organism [dynamics]="data.value().dynamics" />
        <app-top-positions-organism [stock]="stock()" />
      } @else if (data.isEmpty()) {
        <div class="empty">
          <p class="empty-title">Склад ещё не синхронизирован</p>
          <p class="empty-note">Слепков остатков нет — данные появятся после первого синка склада из iiko.</p>
        </div>
      } @else if (data.error()) {
        <app-load-error message="Не удалось загрузить данные склада" />
      } @else {
        <p class="loading">Загрузка…</p>
      }
    </app-warehouse-layout-template>
  `,
  styleUrl: './warehouse-page.component.scss',
})
export class WarehousePageComponent {
  private readonly warehouseStore = inject(WarehouseDataStore);
  readonly data = this.warehouseStore.data;

  readonly stock = computed(() => {
    if (!this.data.hasValue()) return [];
    return computeWarehouseStock(this.data.value().positions);
  });
}
