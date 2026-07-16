import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';

import { PopoverController } from '../../../../core/state/popover.controller';
import { PanelHeaderComponent } from '../../../../ui/molecules/panel-header/panel-header.component';
import { SegmentControlComponent } from '../../../../ui/molecules/segment-control/segment-control.component';
import type { ChartDisplayMode, PeriodGranularity } from '../../../../shared/models/common.model';
import type { ApiPeriod } from '../../../../shared/models/dashboard-api.model';
import type { RevenueDay } from '../../../../shared/models';
import { chartDisplayOptionsForTimeframe } from '../../../../shared/constants/chart-display.constants';
import {
  chartDisplayLegend,
  chartDisplayTitle,
} from '../../../../shared/utils/chart-display.utils';
import {
  buildAggregatedBarDetailPopover,
  buildDayDetailPopover,
  buildMonthDetailPopover,
} from '../../../../shared/utils/day-detail.utils';
import { buildRevenueDaysChartLayout } from '../../../../shared/utils/revenue-days-chart.utils';

@Component({
  selector: 'app-revenue-days-chart-organism',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PanelHeaderComponent, SegmentControlComponent],
  template: `
    <div class="panel">
      <app-panel-header [title]="chartTitle()">
        <app-segment-control
          [options]="displayOptions()"
          [value]="displayMode()"
          (valueChange)="displayModeChange.emit($event)"
        />
      </app-panel-header>
      <div class="legend">
        <span class="legend-hint">{{ legendHint() }}</span>
      </div>
      <div class="chart-wrap" [class.chart-wrap--loading]="loading()">
        <svg
          [attr.viewBox]="'0 0 ' + layout().width + ' ' + layout().height"
          preserveAspectRatio="xMidYMid meet"
          (click)="onChartClick($event)"
        >
          <defs>
            <linearGradient id="dayg" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stop-color="#19A06B" />
              <stop offset="1" stop-color="#3DDC97" />
            </linearGradient>
          </defs>

          @for (line of layout().gridLines; track line.y) {
            <line
              [attr.x1]="layout().paddingLeft"
              [attr.y1]="line.y"
              [attr.x2]="layout().width - layout().paddingRight"
              [attr.y2]="line.y"
              stroke="var(--chart-grid)"
            />
            <text
              [attr.x]="layout().paddingLeft - 8"
              [attr.y]="line.y + 4"
              text-anchor="end"
              font-size="10"
              fill="var(--chart-axis)"
              font-family="Manrope"
            >
              {{ line.label }}
            </text>
          }

          @for (bar of layout().bars; track bar.index) {
            @if (bar.hasMark) {
              <line
                class="dbar-plan-stem"
                [attr.x1]="bar.markX"
                [attr.y1]="bar.markY"
                [attr.x2]="bar.markX"
                [attr.y2]="bar.baselineY"
                stroke="var(--mark-plan)"
                stroke-width="1.5"
                stroke-linecap="round"
                pointer-events="none"
              />
            }
            <rect
              class="dbar dbar--interactive"
              [attr.data-i]="bar.index"
              [attr.x]="bar.x"
              [attr.y]="bar.y"
              [attr.width]="bar.w"
              [attr.height]="bar.h"
              rx="5"
              fill="url(#dayg)"
              (click)="onBarClick($event, bar.index)"
            />
            @if (bar.hasMark) {
              <line
                class="dbar-plan-mark"
                [attr.x1]="bar.x - 3"
                [attr.y1]="bar.markY"
                [attr.x2]="bar.x + bar.w + 3"
                [attr.y2]="bar.markY"
                stroke="var(--mark-plan)"
                stroke-width="2"
                stroke-linecap="round"
                pointer-events="none"
              />
            }
            <text
              [attr.x]="bar.labelX"
              [attr.y]="layout().height - 9"
              text-anchor="middle"
              font-size="10"
              [attr.fill]="bar.weekend ? 'var(--chart-weekend)' : 'var(--chart-axis)'"
              font-family="Manrope"
            >
              {{ bar.label }}
            </text>
          }

          @if (selectedIndex() !== null) {
            @let sel = layout().bars[selectedIndex()!];
            <rect
              [attr.x]="sel.x"
              [attr.y]="sel.y"
              [attr.width]="sel.w"
              [attr.height]="sel.h"
              rx="5"
              fill="none"
              stroke="var(--chart-selection)"
              stroke-width="2"
              class="dbar-selection"
              pointer-events="none"
            />
          }
        </svg>
        @if (loading()) {
          <div class="chart-wrap__overlay" aria-live="polite" aria-busy="true">
            <span class="chart-wrap__spinner" aria-hidden="true"></span>
            <span class="chart-wrap__loading-text">Загрузка…</span>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .legend-hint {
      color: var(--mut2);
    }

    .dbar--interactive {
      cursor: pointer;
    }

    .dbar-selection {
      filter: drop-shadow(0 0 6px rgba(110, 107, 255, 0.7));
    }

    .chart-wrap {
      position: relative;
    }

    .chart-wrap--loading svg {
      opacity: 0.45;
      pointer-events: none;
    }

    .chart-wrap__overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      border-radius: 12px;
      background: rgba(12, 14, 24, 0.08);
      backdrop-filter: blur(1px);
    }

    .chart-wrap__spinner {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      border: 2px solid rgba(110, 107, 255, 0.25);
      border-top-color: rgba(110, 107, 255, 0.85);
      animation: chart-spin 0.75s linear infinite;
    }

    .chart-wrap__loading-text {
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--mut);
    }

    @keyframes chart-spin {
      to {
        transform: rotate(360deg);
      }
    }

    svg {
      width: 100%;
      height: auto;
      display: block;
    }
  `,
})
export class RevenueDaysChartOrganismComponent {
  private readonly popovers = inject(PopoverController);

  readonly days = input.required<RevenueDay[]>();
  readonly max = input.required<number>();
  readonly period = input.required<ApiPeriod>();
  readonly loading = input(false);
  readonly timeframe = input.required<PeriodGranularity>();
  readonly displayMode = input.required<ChartDisplayMode>();

  readonly displayModeChange = output<ChartDisplayMode>();

  protected readonly displayOptions = computed(() =>
    chartDisplayOptionsForTimeframe(this.timeframe()),
  );

  protected readonly chartTitle = computed(() => chartDisplayTitle(this.displayMode()));
  protected readonly legendHint = computed(() => chartDisplayLegend(this.displayMode()));
  protected readonly selectedIndex = signal<number | null>(null);

  protected readonly layout = computed(() =>
    buildRevenueDaysChartLayout(this.days(), this.max(), this.displayMode(), this.timeframe()),
  );

  constructor() {
    effect(() => {
      const active = this.popovers.active();
      if (!active?.key.startsWith('day-')) {
        this.selectedIndex.set(null);
      }
    });
  }

  onBarClick(event: MouseEvent, index: number): void {
    event.stopPropagation();
    event.preventDefault();
    const bar = this.layout().bars[index];
    const mode = this.displayMode();

    if (this.selectedIndex() === index && this.popovers.active()?.key === `day-${index}`) {
      this.selectedIndex.set(null);
      this.popovers.hide();
      return;
    }

    this.selectedIndex.set(index);
    this.popovers.show({
      key: `day-${index}`,
      placement: 'above',
      variant: 'day',
      anchor: (event.currentTarget as SVGRectElement).getBoundingClientRect(),
      detail: this.buildBarDetail(bar.day, mode, bar.label),
    });
  }

  onChartClick(event: MouseEvent): void {
    if ((event.target as Element).classList?.contains('dbar')) return;
    this.selectedIndex.set(null);
    this.popovers.hide();
  }

  private buildBarDetail(day: RevenueDay, mode: ChartDisplayMode, label: string) {
    if (mode === 'day') {
      return buildDayDetailPopover(day, this.period());
    }
    if (mode === 'month') {
      return buildMonthDetailPopover(day, this.period().year);
    }
    return buildAggregatedBarDetailPopover(day, label, this.period().year);
  }
}
