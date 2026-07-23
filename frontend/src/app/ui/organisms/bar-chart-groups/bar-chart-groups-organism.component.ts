import { Component, input } from '@angular/core';

import { CAT_COLOR } from '../../../shared/constants/category.constants';
import { MoneyPipe } from '../../../shared/pipes/format.pipes';
import { BarRowComponent } from '../../molecules/bar-row/bar-row.component';
import type { CategoryKey } from '../../../shared/models';

export interface BarChartGroupRow {
  name: string;
  rev: number;
  gp: number;
}

export interface BarChartGroup {
  category: CategoryKey;
  title: string;
  rows: BarChartGroupRow[];
}

@Component({
  selector: 'app-bar-chart-groups-organism',
  standalone: true,
  imports: [MoneyPipe, BarRowComponent],
  template: `
    <div class="bars-legend">
      <span><i class="sw rev"></i>Выручка</span>
      <span><i class="sw gp"></i>Валовая прибыль</span>
    </div>
    <div class="bars">
      @for (group of groups(); track group.category) {
        <div class="bar-group">
          <div class="bg-title" [style.--cc]="color(group.category)">{{ group.title }}</div>
          @for (row of group.rows; track row.name) {
            <app-bar-row
              variant="dual-rev-gp"
              [name]="row.name"
              [revWidth]="revWidth(row.rev)"
              [gpWidth]="gpWidth(row.gp)"
              [revLabel]="row.rev | money"
              [gpLabel]="row.gp | money"
              [shareLabel]="share(row.rev) + ' % от выручки'"
            />
          }
        </div>
      }
    </div>
  `,
  styleUrl: './bar-chart-groups-organism.component.scss',
})
export class BarChartGroupsOrganismComponent {
  readonly groups = input.required<BarChartGroup[]>();
  readonly maxRev = input.required<number>();
  readonly totalRev = input.required<number>();

  color(category: keyof typeof CAT_COLOR): string {
    return CAT_COLOR[category];
  }

  revWidth(rev: number): number {
    return Math.round((rev / this.maxRev()) * 1000) / 10;
  }

  gpWidth(gp: number): number {
    return Math.round((gp / this.maxRev()) * 1000) / 10;
  }

  share(rev: number): string {
    return ((rev / this.totalRev()) * 100).toFixed(1).replace('.', ',');
  }
}
