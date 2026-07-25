import { Component, computed, input } from '@angular/core';

import { PanelHeaderComponent } from '../../../../ui/molecules/panel-header/panel-header.component';
import { PanelBusyOverlayComponent } from '../../../../ui/molecules/panel-busy-overlay/panel-busy-overlay.component';
import { ProgressFillComponent } from '../../../../ui/atoms/progress-fill/progress-fill.component';
import { ProgressTrackComponent } from '../../../../ui/atoms/progress-track/progress-track.component';
import { MarkLineComponent } from '../../../../ui/atoms/mark-line/mark-line.component';
import { PctPipe, SignedPpPipe } from '../../../../shared/pipes/format.pipes';
import type { DashboardData } from '../../../../shared/models';
import {
  foodcostGaugePosition,
  foodcostGaugeTone,
} from '../../../../shared/utils/foodcost-gauge.utils';

@Component({
  selector: 'app-foodcost-mini-organism',
  standalone: true,
  imports: [
    PanelHeaderComponent,
    PanelBusyOverlayComponent,
    ProgressFillComponent,
    ProgressTrackComponent,
    MarkLineComponent,
    PctPipe,
    SignedPpPipe,
  ],
  template: `
    <div class="panel panel-flat" [class.panel--loading]="loading()">
      <app-panel-header title="Фудкост" />
      <div class="fc-cap">{{ foodcost().caption }}</div>

      <div class="fc-hero">
        <span class="fc-pct" [class]="toneClass()">{{ foodcost().pct | pct }}</span>
        @if (foodcost().goal != null) {
          <div class="fc-meta">
            <span>цель {{ foodcost().goal! | pct }}</span>
            @if (foodcost().deltaPP != null) {
              <span class="fc-dot" aria-hidden="true">·</span>
              <span
                [class.up]="foodcost().dir === 'up'"
                [class.dn]="foodcost().dir === 'dn'"
              >
                {{ foodcost().deltaPP! | signedPp }}
              </span>
            }
          </div>
        }
      </div>

      <div
        class="fc-gauge"
        role="img"
        [attr.aria-label]="gaugeLabel()"
      >
        <app-progress-track variant="fc">
          <app-progress-fill [width]="factPos()" [variant]="tone()" />
          @if (goalPos(); as goal) {
            <app-mark-line [position]="goal" variant="goal" />
          }
        </app-progress-track>
        <div class="fc-scale">
          <span>{{ foodcost().scaleMin | pct }}</span>
          <span>{{ foodcost().scaleMax | pct }}</span>
        </div>
      </div>

      <div class="fc-chips">
        @for (unit of foodcost().units; track unit.key; let last = $last) {
          <span class="fc-chip">
            <span class="fc-chip__name">{{ unit.name }}</span>
            @if (unit.deltaPP != null) {
              <span [class.up]="unit.dir === 'up'" [class.dn]="unit.dir === 'dn'">
                {{ chipDelta(unit.deltaPP) }}
              </span>
            }
          </span>
          @if (!last) {
            <span class="fc-chip__sep" aria-hidden="true">·</span>
          }
        }
      </div>

      @if (loading()) {
        <app-panel-busy-overlay />
      }
    </div>
  `,
  styleUrl: './foodcost-mini-organism.component.scss',
})
export class FoodcostMiniOrganismComponent {
  readonly foodcost = input.required<DashboardData['foodcostMini']>();
  readonly loading = input(false);

  protected readonly tone = computed(() => foodcostGaugeTone(this.foodcost().deltaPP));

  protected readonly toneClass = computed(() => `fc-pct--${this.tone()}`);

  protected readonly factPos = computed(() => {
    const fc = this.foodcost();
    return foodcostGaugePosition(fc.pct, fc.scaleMin, fc.scaleMax);
  });

  protected readonly goalPos = computed(() => {
    const fc = this.foodcost();
    if (fc.goal == null) return null;
    return foodcostGaugePosition(fc.goal, fc.scaleMin, fc.scaleMax);
  });

  protected readonly gaugeLabel = computed(() => {
    const fc = this.foodcost();
    const fmt = (n: number) => `${n.toFixed(1).replace('.', ',')} %`;
    if (fc.goal == null) return `Фудкост ${fmt(fc.pct)}`;
    return `Фудкост ${fmt(fc.pct)}, цель ${fmt(fc.goal)}`;
  });

  /** Компактная дельта без «п.п.» — для ряда чипов. */
  protected chipDelta(n: number): string {
    const value = Number.isFinite(n) ? n : 0;
    const sign = value >= 0 ? '+' : '−';
    return `${sign}${Math.abs(value).toFixed(1).replace('.', ',')}`;
  }
}
