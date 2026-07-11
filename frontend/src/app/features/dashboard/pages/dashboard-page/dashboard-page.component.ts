import { Component, HostListener, inject } from '@angular/core';

import { PeriodService } from '../../../../core/services/period.service';
import type { ChartDisplayMode } from '../../../../shared/models/common.model';
import { DashboardDataStore } from '../../data/dashboard-data.store';
import { PopoverController } from '../../../../core/state/popover.controller';
import { LoadErrorComponent } from '../../../../ui/molecules/load-error/load-error.component';
import { DashboardLayoutTemplateComponent } from '../../../../ui/templates/dashboard-layout/dashboard-layout-template.component';
import { KpiGridOrganismComponent } from '../../organisms/kpi-grid/kpi-grid-organism.component';
import { RevenueDaysChartOrganismComponent } from '../../organisms/revenue-days-chart/revenue-days-chart-organism.component';
import { ReviewsPanelOrganismComponent } from '../../organisms/reviews-panel/reviews-panel-organism.component';
import { FoodcostMiniOrganismComponent } from '../../organisms/foodcost-mini/foodcost-mini-organism.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    LoadErrorComponent,
    DashboardLayoutTemplateComponent,
    KpiGridOrganismComponent,
    RevenueDaysChartOrganismComponent,
    ReviewsPanelOrganismComponent,
    FoodcostMiniOrganismComponent,
  ],
  template: `
    <app-dashboard-layout-template>
      @if (viewModel(); as d) {
        <app-kpi-grid-organism [kpis]="d.kpis" [details]="d.details" [loading]="kpiLoading()" />
        <app-revenue-days-chart-organism
          [days]="d.revenueByDay"
          [max]="d.revenueByDayMax"
          [period]="d.chartPeriod"
          [timeframe]="granularity()"
          [displayMode]="d.chartDisplayMode"
          [loading]="chartLoading()"
          (displayModeChange)="onChartDisplayModeChange($event)"
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
    </app-dashboard-layout-template>
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
  private readonly periodService = inject(PeriodService);
  private readonly popovers = inject(PopoverController);

  protected readonly dashboard = this.store.dashboard;
  protected readonly viewModel = this.store.displayedViewModel;
  protected readonly chartLoading = this.store.chartLoadingState;
  protected readonly kpiLoading = this.store.kpiLoadingState;
  protected readonly granularity = this.store.granularity;

  onChartDisplayModeChange(mode: ChartDisplayMode): void {
    this.periodService.setChartDisplayMode(mode);
  }

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
