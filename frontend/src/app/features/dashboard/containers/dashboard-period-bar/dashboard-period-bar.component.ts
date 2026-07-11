import { Component, inject } from '@angular/core';

import { PeriodService } from '../../../../core/services/period.service';
import type { ChartPeriodSelection } from '../../../../shared/models/chart-period.model';
import { PeriodBarComponent } from '../../../../ui/molecules/period-bar/period-bar.component';
import { ChartPeriodPickerComponent } from '../../molecules/chart-period-picker/chart-period-picker.component';
import { DashboardDataStore } from '../../data/dashboard-data.store';

@Component({
  selector: 'app-dashboard-period-bar',
  standalone: true,
  imports: [PeriodBarComponent, ChartPeriodPickerComponent],
  template: `
    <app-period-bar [period]="periodInfo()" [(granularity)]="granularity">
      @if (picker(); as config) {
        <app-chart-period-picker
          periodDate
          class="period-bar__date"
          [label]="config.label"
          [note]="config.note"
          [granularity]="config.granularity"
          [bounds]="config.bounds"
          [activePeriod]="config.activePeriod"
          [selection]="config.selection"
          [showReset]="config.showReset"
          (applied)="onApplied($event)"
          (resetSelection)="onReset()"
        />
      }
    </app-period-bar>
  `,
})
export class DashboardPeriodBarComponent {
  private readonly store = inject(DashboardDataStore);
  private readonly periodService = inject(PeriodService);

  protected readonly granularity = this.periodService.granularity;
  protected readonly periodInfo = this.store.chartPeriodBarInfo;
  protected readonly picker = this.store.chartPickerConfig;

  onApplied(selection: ChartPeriodSelection): void {
    this.periodService.applyChartPeriod(selection);
  }

  onReset(): void {
    this.periodService.resetChartPeriodToLatest();
  }
}
