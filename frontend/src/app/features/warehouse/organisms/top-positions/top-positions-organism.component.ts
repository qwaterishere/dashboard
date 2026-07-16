import { Component, computed, input, model } from '@angular/core';

import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { SegmentControlComponent } from '../../../../ui/molecules/segment-control/segment-control.component';
import { FmtPipe, MoneyPipe } from '../../../../shared/pipes/format.pipes';
import {
  topPositionsMax,
  topWarehousePositions,
  type TopPositionsMetric,
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

      <div class="top-bars">
        @for (row of rows(); track row.productId; let i = $index) {
          <div class="top-row">
            <span class="top-rank">{{ i + 1 }}</span>
            <span class="top-name">{{ row.name }}</span>
            <span class="top-track" [class]="row.store">
              <i [style.width.%]="barWidth(row)"></i>
            </span>
            <span class="top-val">
              @if (metric() === 'money') {
                {{ row.sum | money }}
              } @else {
                {{ row.qty | fmt }} <small>{{ row.unit }}</small>
              }
            </span>
          </div>
        }
      </div>
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

  protected readonly rows = computed(() =>
    topWarehousePositions(this.stock(), this.metric()),
  );

  protected readonly maxValue = computed(() =>
    topPositionsMax(this.rows(), this.metric()),
  );

  barWidth(row: WarehouseStockRow): number {
    const max = this.maxValue();
    const value = this.metric() === 'money' ? row.sum : row.qty;
    return max ? Math.round((value / max) * 1000) / 10 : 0;
  }
}
