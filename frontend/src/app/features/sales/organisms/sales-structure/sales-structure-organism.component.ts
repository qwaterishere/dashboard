import { Component, computed, inject, input, model } from '@angular/core';

import { CAT_COLOR } from '../../../../shared/constants/category.constants';
import { formatMoney } from '../../../../shared/utils/money-format.utils';
import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { SegmentControlComponent } from '../../../../ui/molecules/segment-control/segment-control.component';
import { LegendRowComponent } from '../../../../ui/molecules/legend-row/legend-row.component';
import { DonutChartOrganismComponent } from '../../../../ui/organisms/donut-chart/donut-chart-organism.component';
import { BarChartGroupsOrganismComponent } from '../../../../ui/organisms/bar-chart-groups/bar-chart-groups-organism.component';
import { MoneyPipe } from '../../../../shared/pipes/format.pipes';
import { CurrencyService } from '../../../../core/state/currency.service';
import {
  barChartScale,
  buildBarGroups,
  buildDonutSlices,
  type SalesPositionComputed,
  type SalesStructureLevel,
} from '../../data/sales-aggregation.utils';

@Component({
  selector: 'app-sales-structure-organism',
  standalone: true,
  imports: [
    HeadingComponent,
    SegmentControlComponent,
    DonutChartOrganismComponent,
    BarChartGroupsOrganismComponent,
    LegendRowComponent,
    MoneyPipe,
  ],
  template: `
    <div class="block">
      <div class="block-head">
        <app-heading [level]="2" text="Структура продаж" />
        <app-segment-control
          [options]="levelOptions"
          [(value)]="level"
        />
      </div>

      @if (level() === 'cat') {
        <div class="donut-wrap">
          <app-donut-chart-organism
            [slices]="donutSlices()"
            [(highlightKey)]="highlightKey"
            centerLabel="Выручка"
            [centerValue]="donutTotals().rev | money"
            [centerSub]="centerSub()"
          />

          <div class="legend-side">
            <div class="lg-head">
              <span>Выручка</span>
              <span>Вал. прибыль</span>
            </div>
            @for (slice of donutData(); track slice.key) {
              <app-legend-row
                layout="sales-dual"
                [name]="slice.name"
                [color]="slice.color"
                [caption]="shareLabel(slice.rev) + ' % от выручки'"
                (mouseenter)="highlightKey.set(slice.key)"
                (mouseleave)="highlightKey.set(null)"
              >
                <b class="lg-r">{{ slice.rev | money }}</b>
                <b class="lg-g">{{ slice.gp | money }}</b>
              </app-legend-row>
            }
          </div>
        </div>
      } @else {
        <app-bar-chart-groups-organism
          [groups]="barGroups()"
          [maxRev]="barScale().maxRev"
          [totalRev]="barScale().totalRev"
        />
      }
    </div>
  `,
  styleUrl: './sales-structure-organism.component.scss',
})
export class SalesStructureOrganismComponent {
  private readonly currency = inject(CurrencyService);

  readonly positions = input.required<SalesPositionComputed[]>();
  readonly level = model<SalesStructureLevel>('cat');
  readonly highlightKey = model<string | null>(null);

  protected readonly levelOptions = [
    { value: 'cat' as const, label: 'Категории' },
    { value: 'sub' as const, label: 'Подкатегории' },
  ];

  protected readonly donutData = computed(() =>
    buildDonutSlices(this.positions(), CAT_COLOR),
  );

  protected readonly donutSlices = computed(() =>
    this.donutData().map((slice) => ({
      key: slice.key,
      color: slice.color,
      value: slice.rev,
    })),
  );

  protected readonly donutTotals = computed(() => ({
    rev: this.donutData().reduce((sum, slice) => sum + slice.rev, 0),
    gp: this.donutData().reduce((sum, slice) => sum + slice.gp, 0),
  }));

  protected readonly centerSub = computed(() => {
    this.currency.code();
    return `прибыль ${formatMoney(this.donutTotals().gp)}`;
  });

  protected readonly barGroups = computed(() =>
    buildBarGroups(this.positions(), this.level()),
  );

  protected readonly barScale = computed(() => barChartScale(this.barGroups()));

  shareLabel(rev: number): string {
    const total = this.donutTotals().rev;
    return total ? Math.round((rev / total) * 100).toString() : '0';
  }
}
