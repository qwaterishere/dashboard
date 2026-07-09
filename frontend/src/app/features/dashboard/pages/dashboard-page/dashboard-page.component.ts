import { Component, HostListener, inject } from '@angular/core';

import { DashboardDataStore } from '../../data/dashboard-data.store';
import { PopoverController } from '../../../../core/state/popover.controller';
import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';
import { KpiGridOrganismComponent } from '../../organisms/kpi-grid/kpi-grid-organism.component';
import { RevenueDaysChartOrganismComponent } from '../../organisms/revenue-days-chart/revenue-days-chart-organism.component';
import { ReviewsPanelOrganismComponent } from '../../organisms/reviews-panel/reviews-panel-organism.component';
import { FoodcostMiniOrganismComponent } from '../../organisms/foodcost-mini/foodcost-mini-organism.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    LoadErrorComponent,
    KpiGridOrganismComponent,
    RevenueDaysChartOrganismComponent,
    ReviewsPanelOrganismComponent,
    FoodcostMiniOrganismComponent,
  ],
  template: `
    @if (viewModel(); as d) {
      <app-kpi-grid-organism [kpis]="d.kpis" [details]="d.details" />
      <app-revenue-days-chart-organism
        [days]="d.revenueByDay"
        [max]="d.revenueByDayMax"
        [period]="d.chartPeriod"
        [periodLabel]="d.period.label"
      />
      <div class="row2">
        @if (d.reviews) {
          <app-reviews-panel-organism [reviews]="d.reviews" />
        }
        <app-foodcost-mini-organism [foodcost]="d.foodcostMini" />
      </div>
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

    .loading {
      color: var(--mut2);
      font-size: 0.9rem;
    }
  `,
})
export class DashboardPageComponent {
  private readonly store = inject(DashboardDataStore);
  private readonly popovers = inject(PopoverController);

  protected readonly dashboard = this.store.dashboard;
  protected readonly viewModel = this.store.viewModel;

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.dbar, .kpop, [appPopoverTrigger]')) return;
    this.popovers.hide();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.popovers.hide();
  }
}
