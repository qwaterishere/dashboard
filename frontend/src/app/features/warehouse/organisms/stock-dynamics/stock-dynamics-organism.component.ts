import { Component, computed, input, model } from '@angular/core';

import { CAT_NAME } from '../../../../shared/constants/category.constants';
import { HeadingComponent } from '../../../../ui/atoms/heading/heading.component';
import { SegmentControlComponent } from '../../../../ui/molecules/segment-control/segment-control.component';
import type { CategoryKey, WarehouseData } from '../../../../shared/models';
import { buildStockChartLayout } from '../../data/stock-dynamics.utils';

type StoreFilter = CategoryKey | 'all';
type FreqFilter = 'week' | 'month';

@Component({
  selector: 'app-stock-dynamics-organism',
  standalone: true,
  imports: [HeadingComponent, SegmentControlComponent],
  template: `
    <div class="block">
      <div class="block-head">
        <app-heading [level]="2" text="Динамика товарных запасов" />
        <div class="controls">
          <app-segment-control class="seg-sm" [options]="storeOptions" [(value)]="store" />
          <app-segment-control class="seg-sm" [options]="freqOptions" [(value)]="freq" />
        </div>
      </div>

      <svg
        class="stock-chart"
        [attr.viewBox]="'0 0 ' + chart().width + ' ' + chart().height"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="stockArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" [attr.stop-color]="chart().color" stop-opacity="0.25" />
            <stop offset="1" [attr.stop-color]="chart().color" stop-opacity="0" />
          </linearGradient>
        </defs>

        @for (line of chart().gridLines; track line.label) {
          <line
            x1="70"
            [attr.y1]="line.y"
            x2="880"
            [attr.y2]="line.y"
            stroke="#1B2236"
          />
          <text
            x="62"
            [attr.y]="line.y + 4"
            text-anchor="end"
            font-size="10"
            fill="#5A6480"
            font-family="Manrope, sans-serif"
          >
            {{ line.label }}
          </text>
        }

        <polygon [attr.points]="chart().areaPoints" fill="url(#stockArea)" />
        <polyline
          [attr.points]="chart().polylinePoints"
          fill="none"
          [attr.stroke]="chart().color"
          stroke-width="2.5"
        />

        @for (dot of chart().dots; track $index) {
          <circle
            [attr.cx]="dot.cx"
            [attr.cy]="dot.cy"
            r="3.5"
            fill="#0D1220"
            [attr.stroke]="chart().color"
            stroke-width="2"
          />
        }

        @for (label of chart().xLabels; track label.text) {
          <text
            [attr.x]="label.x"
            y="268"
            text-anchor="middle"
            font-size="10"
            fill="#8590A8"
            font-family="Manrope, sans-serif"
          >
            {{ label.text }}
          </text>
        }
      </svg>
    </div>
  `,
  styleUrl: './stock-dynamics-organism.component.scss',
})
export class StockDynamicsOrganismComponent {
  readonly dynamics = input.required<WarehouseData['dynamics']>();

  readonly store = model<StoreFilter>('all');
  readonly freq = model<FreqFilter>('week');

  protected readonly storeOptions = [
    { value: 'all' as const, label: 'Все склады' },
    ...(['k', 'b', 'w'] as CategoryKey[]).map((key) => ({
      value: key,
      label: CAT_NAME[key],
    })),
  ];

  protected readonly freqOptions = [
    { value: 'week' as const, label: 'Недели' },
    { value: 'month' as const, label: 'Месяцы' },
  ];

  protected readonly chart = computed(() => {
    const series = this.dynamics()[this.store()][this.freq()];
    return buildStockChartLayout(series.labels, series.values, this.store());
  });
}
