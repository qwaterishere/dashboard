import { Component, input } from '@angular/core';

import { KpiCardOrganismComponent } from '../kpi-card/kpi-card-organism.component';
import { PopoverTriggerDirective } from '../../../../ui/directives/popover-trigger.directive';
import type { PeriodGranularity } from '../../../../shared/models/common.model';
import type { DashboardData } from '../../../../shared/models';
import { FmtPipe, MoneyPipe } from '../../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-kpi-grid-organism',
  standalone: true,
  imports: [KpiCardOrganismComponent, PopoverTriggerDirective, FmtPipe, MoneyPipe],
  template: `
    <div class="kpis" [class.kpis--loading]="loading()">
      <app-kpi-card-organism
        heading="Выручка"
        tone="kpi-rev"
        [value]="kpis().revenue.value"
        valueFormat="money"
        [lflPct]="kpis().revenue.lfl?.pct"
        [lflDir]="kpis().revenue.lfl?.dir"
        [comparisonLabel]="kpis().revenue.comparisonLabel ?? 'LfL'"
        [lflLoading]="lflLoading()"
        [forecastHeadline]="kpis().revenue.forecast.headline ?? '—'"
        [forecastLabel]="kpis().revenue.forecast.label ?? 'Прогноз на конец месяца'"
        [trackPct]="kpis().revenue.forecast.trackPct"
        [planPct]="kpis().revenue.forecast.planPct"
        [risk]="kpis().revenue.forecast.risk"
        lflPopoverKey="rev-lfl"
        goalPopoverKey="rev-goal"
        [weekFooter]="kpis().revenue.weekFooter"
        [showForecast]="timeframe() !== 'week'"
        [popoverDetails]="details()"
      >
        <span subtext>
          {{ kpis().revenue.checks | fmt }} чеков · {{ kpis().revenue.guests | fmt }} гостя
        </span>
      </app-kpi-card-organism>

      <app-kpi-card-organism
        heading="Средний чек"
        tone="kpi-check"
        [value]="kpis().avgCheck.value"
        valueFormat="money"
        [lflPct]="kpis().avgCheck.lfl?.pct"
        [lflDir]="kpis().avgCheck.lfl?.dir"
        [comparisonLabel]="kpis().avgCheck.comparisonLabel ?? 'LfL'"
        [lflLoading]="lflLoading()"
        [forecastHeadline]="kpis().avgCheck.forecast.headline ?? '—'"
        [forecastLabel]="kpis().avgCheck.forecast.label ?? 'Прогноз на конец месяца'"
        [trackPct]="kpis().avgCheck.forecast.trackPct"
        [planPct]="kpis().avgCheck.forecast.planPct"
        [risk]="kpis().avgCheck.forecast.risk"
        lflPopoverKey="check-lfl"
        goalPopoverKey="check-goal"
        [weekFooter]="kpis().avgCheck.weekFooter"
        [showForecast]="timeframe() !== 'week'"
        [popoverDetails]="details()"
      >
        <span subtext>
          на гостя: <b>{{ kpis().avgCheck.perGuest | money }}</b>
          @if (kpis().avgCheck.qualityFlag) {
            <span
              class="dq-icon"
              appPopoverTrigger="check-quality"
              [popoverDetails]="details()"
              role="img"
              aria-label="признак занижения гостей"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.3 4.2L2.6 17.6a2 2 0 001.7 3h15.4a2 2 0 001.7-3L13.7 4.2a2 2 0 00-3.4 0z" />
                <path d="M12 9.5v4" />
                <path d="M12 17.2v.01" />
              </svg>
            </span>
          }
        </span>
      </app-kpi-card-organism>

      <app-kpi-card-organism
        heading="Чеки"
        tone="kpi-guests"
        [value]="kpis().guests.value"
        valueFormat="number"
        [lflPct]="kpis().guests.lfl?.pct"
        [lflDir]="kpis().guests.lfl?.dir"
        [comparisonLabel]="kpis().guests.comparisonLabel ?? 'LfL'"
        [lflLoading]="lflLoading()"
        [forecastHeadline]="kpis().guests.forecast.headline ?? '—'"
        [forecastLabel]="kpis().guests.forecast.label ?? 'Прогноз на конец месяца'"
        [trackPct]="kpis().guests.forecast.trackPct"
        [planPct]="kpis().guests.forecast.planPct"
        [risk]="kpis().guests.forecast.risk"
        lflPopoverKey="guests-lfl"
        goalPopoverKey="guests-goal"
        [weekFooter]="kpis().guests.weekFooter"
        [showForecast]="timeframe() !== 'week'"
        [popoverDetails]="details()"
      >
        <span subtext>
          {{ kpis().guests.guests | fmt }} гостя
        </span>
      </app-kpi-card-organism>
      @if (loading()) {
        <div class="kpis__overlay" aria-live="polite" aria-busy="true">
          <span class="kpis__spinner" aria-hidden="true"></span>
          <span class="kpis__loading-text">Загрузка…</span>
        </div>
      }
    </div>
  `,
  styles: `
    .kpis {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      align-items: stretch;
      gap: 16px;
      margin-bottom: 16px;
      position: relative;
    }

    .kpis--loading > app-kpi-card-organism {
      opacity: 0.45;
      pointer-events: none;
    }

    .kpis__overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      z-index: 1;
    }

    .kpis__spinner {
      width: 22px;
      height: 22px;
      border: 2px solid var(--mut2);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: kpis-spin 0.8s linear infinite;
    }

    .kpis__loading-text {
      color: var(--mut2);
      font-size: 0.85rem;
    }

    @keyframes kpis-spin {
      to {
        transform: rotate(360deg);
      }
    }

    .kpis > app-kpi-card-organism {
      display: block;
      min-width: 0;
      min-height: 0;
    }

    .dq-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 19px;
      height: 19px;
      margin-left: 5px;
      color: var(--amber);
      cursor: pointer;
      vertical-align: -4px;
    }

    .dq-icon svg {
      width: 16px;
      height: 16px;
    }

    .dq-icon:hover {
      filter: brightness(1.25);
    }

    @media (max-width: 900px) {
      .kpis {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class KpiGridOrganismComponent {
  readonly kpis = input.required<DashboardData['kpis']>();
  readonly details = input<Record<string, DashboardData['details'][string]>>({});
  readonly loading = input(false);
  /** Compare overlay — спиннер внутри LfL-бейджа, без dim карточки. */
  readonly lflLoading = input(false);
  /** month | week | year — управляет видимостью прогноза в KPI-карточках. */
  readonly timeframe = input<PeriodGranularity>('month');
}
