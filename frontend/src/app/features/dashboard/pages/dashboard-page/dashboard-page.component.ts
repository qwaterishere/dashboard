import { Component, inject } from '@angular/core';

import { DashboardDataStore } from '../../data/dashboard-data.store';
import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';
import { KpiGridOrganismComponent } from '../../organisms/kpi-grid/kpi-grid-organism.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [LoadErrorComponent, KpiGridOrganismComponent],
  template: `
    @if (dashboard.hasValue()) {
      @let d = dashboard.value();
      <app-kpi-grid-organism [kpis]="d.kpis" />
      <p class="stub">Графики и панели — Фаза 3</p>
    } @else if (dashboard.error()) {
      <app-load-error message="Не удалось загрузить данные дашборда" />
    } @else {
      <p class="loading">Загрузка…</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .stub,
    .loading {
      color: var(--mut2);
      font-size: 0.9rem;
    }
  `,
})
export class DashboardPageComponent {
  private readonly store = inject(DashboardDataStore);
  protected readonly dashboard = this.store.dashboard;
}
