import { Component, input } from '@angular/core';

import { PanelHeaderComponent } from '../../../../ui/molecules/panel-header/panel-header.component';
import { ProgressFillComponent } from '../../../../ui/atoms/progress-fill/progress-fill.component';
import { ProgressTrackComponent } from '../../../../ui/atoms/progress-track/progress-track.component';
import { MarkLineComponent } from '../../../../ui/atoms/mark-line/mark-line.component';
import { PctPipe, SignedPpPipe } from '../../../../shared/pipes/format.pipes';
import type { DashboardData } from '../../../../shared/models';
import { foodcostBarWidth } from './foodcost-bar-scale.utils';

@Component({
  selector: 'app-foodcost-mini-organism',
  standalone: true,
  imports: [
    PanelHeaderComponent,
    ProgressFillComponent,
    ProgressTrackComponent,
    MarkLineComponent,
    PctPipe,
    SignedPpPipe,
  ],
  template: `
    <div class="panel panel-flat">
      <app-panel-header title="Фудкост" />
      <div class="fc-cap">{{ foodcost().caption }}</div>
      <div class="fc-list">
        @for (item of foodcost().items; track item.key) {
          <div class="fc-item">
            <div class="fc-top">
              <span class="fc-name">{{ item.name }}</span>
              <span class="fc-pct">{{ item.pct | pct }}</span>
            </div>
            <app-progress-track variant="fc">
              <app-progress-fill [width]="barWidth(item.pct)" [category]="item.key" />
              <app-mark-line [position]="barWidth(item.goal)" variant="goal" />
            </app-progress-track>
            <div class="fc-sub">
              цель {{ goalLabel(item.goal) }} ·
              <span [class.up]="item.dir === 'up'" [class.dn]="item.dir === 'dn'">
                {{ item.deltaPP | signedPp }}
              </span>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styleUrl: './foodcost-mini-organism.component.scss',
})
export class FoodcostMiniOrganismComponent {
  readonly foodcost = input.required<DashboardData['foodcostMini']>();

  barWidth(pct: number): number {
    return foodcostBarWidth(pct);
  }

  goalLabel(goal: number): string {
    return `${Math.round(goal)} %`;
  }
}
