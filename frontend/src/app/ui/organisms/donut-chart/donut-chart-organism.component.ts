import { Component, computed, input, model } from '@angular/core';

import { buildDonutChartLayout } from '../../../shared/utils/donut-chart.utils';

export interface DonutChartSlice {
  key: string;
  color: string;
  value: number;
}

@Component({
  selector: 'app-donut-chart-organism',
  standalone: true,
  template: `
    <div class="donut-side">
      <svg viewBox="0 0 220 220" aria-label="структура продаж">
        <defs>
          @for (slice of layout().slices; track slice.key) {
            <linearGradient [attr.id]="slice.gradientId" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" [attr.stop-color]="slice.color" />
              <stop offset="1" [attr.stop-color]="slice.shadedColor" />
            </linearGradient>
          }
          <radialGradient id="donutInnerShade" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0.60" stop-color="#000" stop-opacity="0" />
            <stop offset="0.70" stop-color="#000" stop-opacity="0.4" />
            <stop offset="0.73" stop-color="#000" stop-opacity="0" />
          </radialGradient>
        </defs>
        @for (slice of layout().slices; track slice.key) {
          <path
            class="donut-seg"
            [class.dim]="highlightKey() && highlightKey() !== slice.key"
            [attr.d]="slice.path"
            fill="none"
            [attr.stroke]="'url(#' + slice.gradientId + ')'"
            [attr.stroke-width]="layout().strokeWidth"
            (mouseenter)="highlightKey.set(slice.key)"
            (mouseleave)="highlightKey.set(null)"
          />
        }
        @if (layout().slices.length) {
          <circle
            [attr.cx]="layout().cx"
            [attr.cy]="layout().cy"
            [attr.r]="layout().r"
            fill="none"
            stroke="url(#donutInnerShade)"
            [attr.stroke-width]="layout().strokeWidth"
            pointer-events="none"
          />
        }
      </svg>
      <div class="donut-center">
        @if (centerLabel()) {
          <div class="dc-label">{{ centerLabel() }}</div>
        }
        <div class="dc-val">{{ centerValue() }}</div>
        @if (centerSub()) {
          <div class="dc-sub">{{ centerSub() }}</div>
        }
      </div>
    </div>
  `,
  styleUrl: './donut-chart-organism.component.scss',
})
export class DonutChartOrganismComponent {
  readonly slices = input.required<DonutChartSlice[]>();
  readonly highlightKey = model<string | null>(null);
  readonly centerLabel = input('');
  readonly centerValue = input.required<string>();
  readonly centerSub = input('');

  protected readonly layout = computed(() =>
    buildDonutChartLayout(
      this.slices().map((slice) => ({
        key: slice.key,
        color: slice.color,
        value: slice.value,
      })),
    ),
  );
}
