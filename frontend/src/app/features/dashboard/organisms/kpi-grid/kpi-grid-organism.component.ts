import { Component, input } from '@angular/core';

import { KpiCardOrganismComponent } from '../kpi-card/kpi-card-organism.component';
import { PopoverTriggerDirective } from '../../../../ui/directives/popover-trigger.directive';
import type { DashboardData } from '../../../../shared/models';
import { FmtPipe, MoneyPipe } from '../../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-kpi-grid-organism',
  standalone: true,
  imports: [KpiCardOrganismComponent, PopoverTriggerDirective, FmtPipe, MoneyPipe],
  template: `
    <div class="kpis">
      <app-kpi-card-organism
        title="Выручка"
        tone="kpi-rev"
        [value]="kpis().revenue.value"
        valueFormat="money"
        [lflPct]="kpis().revenue.lfl?.pct"
        [lflDir]="kpis().revenue.lfl?.dir"
        [forecastHeadline]="kpis().revenue.forecast.headline ?? '—'"
        [trackPct]="kpis().revenue.forecast.trackPct"
        [risk]="kpis().revenue.forecast.risk"
        lflPopoverKey="rev-lfl"
        goalPopoverKey="rev-goal"
        [popoverDetails]="details()"
      >
        <span subtext>
          {{ kpis().revenue.checks | fmt }} чеков · {{ kpis().revenue.guests | fmt }} гостя
        </span>
      </app-kpi-card-organism>

      <app-kpi-card-organism
        title="Средний чек"
        tone="kpi-check"
        [value]="kpis().avgCheck.value"
        valueFormat="money"
        [lflPct]="kpis().avgCheck.lfl?.pct"
        [lflDir]="kpis().avgCheck.lfl?.dir"
        [forecastHeadline]="kpis().avgCheck.forecast.headline ?? '—'"
        [trackPct]="kpis().avgCheck.forecast.trackPct"
        [risk]="kpis().avgCheck.forecast.risk"
        lflPopoverKey="check-lfl"
        goalPopoverKey="check-goal"
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
        title="Гости"
        tone="kpi-guests"
        [value]="kpis().guests.value"
        valueFormat="number"
        [lflPct]="kpis().guests.lfl?.pct"
        [lflDir]="kpis().guests.lfl?.dir"
        [forecastHeadline]="kpis().guests.forecast.headline ?? '—'"
        [trackPct]="kpis().guests.forecast.trackPct"
        [risk]="kpis().guests.forecast.risk"
        lflPopoverKey="guests-lfl"
        goalPopoverKey="guests-goal"
        [popoverDetails]="details()"
      >
        <span subtext>
          {{ kpis().guests.perCheck | fmt }} гостя на чек ·
          <b>{{ kpis().guests.checks | fmt }}</b> чеков
        </span>
      </app-kpi-card-organism>
    </div>
  `,
  styles: `
    .kpis {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      align-items: stretch;
      gap: 16px;
      margin-bottom: 16px;
    }

    .kpis > app-kpi-card-organism {
      display: block;
      min-height: 0;
    }

    .dq-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 19px;
      height: 19px;
      margin-left: 5px;
      color: #d9a861;
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
}
