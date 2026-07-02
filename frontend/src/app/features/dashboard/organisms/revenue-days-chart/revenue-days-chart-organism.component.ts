import { Component, inject, input, signal } from '@angular/core';

import { PopoverController } from '../../../../core/state/popover.controller';
import { PanelHeaderComponent } from '../../../../ui/molecules/panel-header/panel-header.component';
import { WEEKDAYS_FULL } from '../../../../shared/constants/category.constants';
import type { DetailPopover, RevenueDay } from '../../../../shared/models';
import { buildRevenueDaysChartLayout } from '../../../../shared/utils/revenue-days-chart.utils';

@Component({
  selector: 'app-revenue-days-chart-organism',
  standalone: true,
  imports: [PanelHeaderComponent],
  template: `
    <div class="panel">
      <app-panel-header title="Выручка по дням">
        <button type="button" class="pill">{{ periodLabel() }}</button>
      </app-panel-header>
      <div class="legend">
        <span style="color: var(--mut2)">клик по дню — детали</span>
      </div>
      <div class="chart-wrap">
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
              stroke="#1B2236"
            />
            <text
              [attr.x]="layout().paddingLeft - 8"
              [attr.y]="line.y + 4"
              text-anchor="end"
              font-size="10"
              fill="#5A6480"
              font-family="Manrope"
            >
              {{ line.label }}
            </text>
          }

          @for (bar of layout().bars; track bar.index) {
            <rect
              class="dbar"
              [attr.data-i]="bar.index"
              [attr.x]="bar.x"
              [attr.y]="bar.y"
              [attr.width]="bar.w"
              [attr.height]="bar.h"
              rx="5"
              fill="url(#dayg)"
              style="cursor: pointer"
              (click)="onBarClick($event, bar.index)"
            />
            <line
              [attr.x1]="bar.x - 3"
              [attr.y1]="bar.planY"
              [attr.x2]="bar.x + bar.w + 3"
              [attr.y2]="bar.planY"
              stroke="#5A6480"
              stroke-width="2"
              stroke-linecap="round"
              pointer-events="none"
            />
            <text
              [attr.x]="bar.labelX"
              [attr.y]="layout().height - 9"
              text-anchor="middle"
              font-size="10"
              [attr.fill]="bar.weekend ? '#9D9BFF' : '#5A6480'"
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
              stroke="#6E6BFF"
              stroke-width="2"
              style="filter: drop-shadow(0 0 6px rgba(110, 107, 255, 0.7))"
              pointer-events="none"
            />
          }
        </svg>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
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
  readonly periodLabel = input('Июнь 2026');

  protected readonly selectedIndex = signal<number | null>(null);

  protected layout() {
    return buildRevenueDaysChartLayout(this.days(), this.max());
  }

  onBarClick(event: MouseEvent, index: number): void {
    event.stopPropagation();
    const bar = this.layout().bars[index];
    const target = event.currentTarget as SVGRectElement;
    const dp = ((bar.day.revenue - bar.day.plan) / bar.day.plan) * 100;
    const tone = dp >= 0 ? 'up' : 'dn';

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
      anchor: target.getBoundingClientRect(),
      detail: {
        title: `${bar.day.day} июня · ${WEEKDAYS_FULL[bar.day.weekday]}`,
        rows: [
          ['Выручка', this.formatMoney(bar.day.revenue)],
          [
            `К плану дня (${this.formatMoney(bar.day.plan)})`,
            this.formatSignedPct(dp),
            tone,
          ],
          [
            'Чеки · средний чек',
            `${bar.day.checks} · ${this.formatMoney(bar.day.avg)}`,
          ],
          ['Гости', this.formatGuests(bar.day.guests)],
        ],
        footnote: 'Подробнее о дне →',
      } satisfies DetailPopover,
    });
  }

  onChartClick(event: MouseEvent): void {
    if ((event.target as Element).classList?.contains('dbar')) return;
    this.selectedIndex.set(null);
    this.popovers.hide();
  }

  private formatMoney(value: number): string {
    return `${Math.round(value).toLocaleString('ru-RU')} ₽`;
  }

  private formatSignedPct(value: number): string {
    const sign = value >= 0 ? '+' : '−';
    return `${sign}${Math.abs(value).toFixed(1).replace('.', ',')} %`;
  }

  private formatGuests(value: number): string {
    return Math.round(value).toLocaleString('ru-RU');
  }
}
