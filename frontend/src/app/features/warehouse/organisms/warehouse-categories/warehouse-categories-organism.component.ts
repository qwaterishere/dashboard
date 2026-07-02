import { Component, computed, input, model } from '@angular/core';

import { CAT_COLOR } from '../../../../shared/constants/category.constants';
import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { SegmentControlComponent } from '../../../../ui/molecules/segment-control/segment-control.component';
import { LegendRowComponent } from '../../../../ui/molecules/legend-row/legend-row.component';
import { DonutChartOrganismComponent } from '../../../../ui/organisms/donut-chart/donut-chart-organism.component';
import { MoneyPipe } from '../../../../shared/pipes/format.pipes';
import type { CategoryKey } from '../../../../shared/models';
import {
  buildWarehouseDonutSlices,
  buildWarehouseSubBarGroups,
  warehouseSubBarMax,
  type WarehouseStockRow,
  type WarehouseStructureLevel,
} from '../../data/warehouse-aggregation.utils';

@Component({
  selector: 'app-warehouse-categories-organism',
  standalone: true,
  imports: [
    HeadingComponent,
    SegmentControlComponent,
    DonutChartOrganismComponent,
    LegendRowComponent,
    MoneyPipe,
  ],
  template: `
    <div class="block">
      <div class="block-head">
        <app-heading [level]="2" text="Запасы по категориям" />
        <app-segment-control class="seg-sm" [options]="levelOptions" [(value)]="level" />
      </div>

      @if (level() === 'cat') {
        <div class="donut-wrap">
          <app-donut-chart-organism
            variant="compact"
            ariaLabel="запасы по категориям"
            [slices]="donutSlices()"
            [(highlightKey)]="highlightKey"
            centerLabel="Всего"
            [centerValue]="donutTotal() | money"
          />

          <div class="legend-side">
            @for (slice of donutData(); track slice.key) {
              <app-legend-row
                [name]="slice.name"
                [color]="slice.color"
                [caption]="shareLabel(slice.sum) + ' % запасов'"
                (mouseenter)="highlightKey.set(slice.key)"
                (mouseleave)="highlightKey.set(null)"
              >
                <b>{{ slice.sum | money }}</b>
              </app-legend-row>
            }
          </div>
        </div>
      } @else {
        <div class="bars">
          @for (group of barGroups(); track group.category) {
            <div class="bar-group">
              <div class="bg-title" [style.--cc]="color(group.category)">{{ group.title }}</div>
              @for (row of group.rows; track row.name) {
                <div class="bar-row">
                  <span class="br-name">{{ row.name }}</span>
                  <span class="br-track">
                    <i [style.width.%]="barWidth(row.sum)"></i>
                  </span>
                  <span class="br-val">{{ row.sum | money }}</span>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styleUrl: './warehouse-categories-organism.component.scss',
})
export class WarehouseCategoriesOrganismComponent {
  readonly stock = input.required<WarehouseStockRow[]>();
  readonly level = model<WarehouseStructureLevel>('cat');
  readonly highlightKey = model<string | null>(null);

  protected readonly levelOptions = [
    { value: 'cat' as const, label: 'Категории' },
    { value: 'sub' as const, label: 'Подкатегории' },
  ];

  protected readonly donutData = computed(() => buildWarehouseDonutSlices(this.stock()));

  protected readonly donutSlices = computed(() =>
    this.donutData().map((slice) => ({
      key: slice.key,
      color: slice.color,
      value: slice.sum,
    })),
  );

  protected readonly donutTotal = computed(() =>
    this.donutData().reduce((sum, slice) => sum + slice.sum, 0),
  );

  protected readonly barGroups = computed(() => buildWarehouseSubBarGroups(this.stock()));

  protected readonly barMax = computed(() => warehouseSubBarMax(this.barGroups()));

  color(category: CategoryKey): string {
    return CAT_COLOR[category];
  }

  shareLabel(sum: number): string {
    const total = this.donutTotal();
    return total ? Math.round((sum / total) * 100).toString() : '0';
  }

  barWidth(sum: number): number {
    const max = this.barMax();
    return max ? Math.round((sum / max) * 1000) / 10 : 0;
  }
}
