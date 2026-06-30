import { Component, input } from '@angular/core';

import { KpiCardOrganismComponent } from '../kpi-card/kpi-card-organism.component';
import type { DashboardData } from '../../../../shared/models';
import { FmtPipe, MoneyPipe, MillionsPipe } from '../../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-kpi-grid-organism',
  standalone: true,
  imports: [KpiCardOrganismComponent, FmtPipe, MoneyPipe, MillionsPipe],
  template: `
    <div class="kpis">
      <app-kpi-card-organism
        title="Выручка"
        tone="kpi-rev"
        [value]="kpis().revenue.value"
        valueFormat="money"
        [lflPct]="kpis().revenue.lfl.pct"
        [lflDir]="kpis().revenue.lfl.dir"
        [forecastHeadline]="(kpis().revenue.forecast.value | millions) + ' · ' + kpis().revenue.forecast.planPct + ' %'"
        [trackPct]="kpis().revenue.forecast.trackPct"
        [risk]="kpis().revenue.forecast.risk"
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
        [lflPct]="kpis().avgCheck.lfl.pct"
        [lflDir]="kpis().avgCheck.lfl.dir"
        [forecastHeadline]="(kpis().avgCheck.forecast.value | money) + ' · ' + kpis().avgCheck.forecast.planPct + ' %'"
        [trackPct]="kpis().avgCheck.forecast.trackPct"
        [risk]="kpis().avgCheck.forecast.risk"
      >
        <span subtext>на гостя: <b>{{ kpis().avgCheck.perGuest | money }}</b></span>
      </app-kpi-card-organism>

      <app-kpi-card-organism
        title="Гости"
        tone="kpi-guests"
        [value]="kpis().guests.value"
        valueFormat="number"
        [lflPct]="kpis().guests.lfl.pct"
        [lflDir]="kpis().guests.lfl.dir"
        [forecastHeadline]="(kpis().guests.forecast.value | fmt) + ' · ' + kpis().guests.forecast.planPct + ' %'"
        [trackPct]="kpis().guests.forecast.trackPct"
        [risk]="kpis().guests.forecast.risk"
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
      gap: 16px;
      margin-bottom: 16px;
    }
    @media (max-width: 900px) {
      .kpis { grid-template-columns: 1fr; }
    }
  `,
})
export class KpiGridOrganismComponent {
  readonly kpis = input.required<DashboardData['kpis']>();
}
