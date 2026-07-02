import { httpResource } from '@angular/common/http';
import { Component, computed } from '@angular/core';

import type { WarehouseData } from '../../../../shared/models';
import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';
import { computeWarehouseStock } from '../../data/warehouse-aggregation.utils';
import { StockTotalsOrganismComponent } from '../../organisms/stock-totals/stock-totals-organism.component';
import { WarehouseCategoriesOrganismComponent } from '../../organisms/warehouse-categories/warehouse-categories-organism.component';
import { StockDynamicsOrganismComponent } from '../../organisms/stock-dynamics/stock-dynamics-organism.component';
import { TopPositionsOrganismComponent } from '../../organisms/top-positions/top-positions-organism.component';

@Component({
  selector: 'app-warehouse-page',
  standalone: true,
  host: { class: 'page-warehouse' },
  imports: [
    LoadErrorComponent,
    StockTotalsOrganismComponent,
    WarehouseCategoriesOrganismComponent,
    StockDynamicsOrganismComponent,
    TopPositionsOrganismComponent,
  ],
  template: `
    @if (data.hasValue()) {
      <div class="row2">
        <app-stock-totals-organism [totals]="data.value().totals" />
        <app-warehouse-categories-organism [stock]="stock()" />
      </div>
      <app-stock-dynamics-organism [dynamics]="data.value().dynamics" />
      <app-top-positions-organism [stock]="stock()" />
    } @else if (data.error()) {
      <app-load-error message="Не удалось загрузить данные склада" />
    } @else {
      <p class="loading">Загрузка…</p>
    }
  `,
  styleUrl: './warehouse-page.component.scss',
})
export class WarehousePageComponent {
  readonly data = httpResource<WarehouseData>(() => ({ url: '/api/warehouse' }));

  readonly stock = computed(() => {
    if (!this.data.hasValue()) return [];
    return computeWarehouseStock(this.data.value().positions);
  });
}
