import { Component, computed, input, model } from '@angular/core';

import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { SegmentControlComponent } from '../../../../ui/molecules/segment-control/segment-control.component';
import { FmtPipe, MoneyPipe } from '../../../../shared/pipes/format.pipes';
import {
  topPositionsMax,
  topWarehousePositions,
  topWarehousePositionsByQtyUnit,
  type TopPositionsMetric,
  type TopPositionsUnitGroup,
  type WarehouseStockRow,
} from '../../data/warehouse-aggregation.utils';

@Component({
  selector: 'app-top-positions-organism',
  standalone: true,
  imports: [HeadingComponent, SegmentControlComponent, MoneyPipe, FmtPipe],
  template: `
    <div class="block">
      <div class="block-head">
        <app-heading [level]="2" text="Наибольший остаток на складе" />
        <app-segment-control size="sm" [options]="metricOptions" [(value)]="metric" />
      </div>

      @if (metric() === 'money') {
        <div class="top-bars">
          @for (row of moneyRows(); track row.productId; let i = $index) {
            <div class="top-row">
              <span class="top-rank">{{ i + 1 }}</span>
              <span class="top-name">{{ row.name }}</span>
              <span class="top-track" [class]="row.store">
                <i [style.width.%]="barWidth(row, moneyMax())"></i>
              </span>
              <span class="top-val">{{ row.sum | money }}</span>
            </div>
          }
        </div>
      } @else {
        <div class="top-groups">
          @for (group of qtyGroups(); track group.family) {
            <section class="top-group">
              <h3 class="top-group__title">{{ group.title }}</h3>
              <div class="top-bars">
                @for (row of group.rows; track row.productId; let i = $index) {
                  <div class="top-row">
                    <span class="top-rank">{{ i + 1 }}</span>
                    <span class="top-name">{{ row.name }}</span>
                    <span class="top-track" [class]="row.store">
                      <i [style.width.%]="barWidth(row, groupMax(group))"></i>
                    </span>
                    <span class="top-val">
                      {{ row.qty | fmt }} <small>{{ row.unit }}</small>
                    </span>
                  </div>
                }
              </div>
            </section>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './top-positions-organism.component.scss',
})
export class TopPositionsOrganismComponent {
  readonly stock = input.required<WarehouseStockRow[]>();
  readonly metric = model<TopPositionsMetric>('money');

  protected readonly metricOptions = [
    { value: 'money' as const, label: 'В деньгах' },
    { value: 'qty' as const, label: 'В количестве' },
  ];

  protected readonly moneyRows = computed(() =>
    topWarehousePositions(this.stock(), 'money'),
  );

  protected readonly moneyMax = computed(() =>
    topPositionsMax(this.moneyRows(), 'money'),
  );

  protected readonly qtyGroups = computed(() =>
    topWarehousePositionsByQtyUnit(this.stock(), 5),
  );

  groupMax(group: TopPositionsUnitGroup): number {
    return topPositionsMax(group.rows, 'qty');
  }

  barWidth(row: WarehouseStockRow, max: number): number {
    const value = this.metric() === 'money' ? row.sum : row.qty;
    return max ? Math.round((value / max) * 1000) / 10 : 0;
  }
}
