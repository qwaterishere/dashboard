import { Component, ElementRef, HostListener, effect, inject, signal, untracked } from '@angular/core';

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
    <app-period-bar [period]="periodInfo()" [(granularity)]="granularity" [reserveCompareSlot]="true">
      @if (picker(); as config) {
        <app-chart-period-picker
          periodDate
          [label]="config.label"
          [note]="config.note"
          [granularity]="config.granularity"
          [bounds]="config.bounds"
          [activePeriod]="config.activePeriod"
          [selection]="config.selection"
          [showReset]="config.showReset"
          [panelOpen]="openPicker() === 'period'"
          (panelOpenChange)="onPanelOpenChange('period', $event)"
          (applied)="onApplied($event)"
          (resetSelection)="onReset()"
        />
      }
      @if (comparePicker(); as config) {
        <app-chart-period-picker
          comparePeriod
          triggerKind="compare"
          [compareWith]="config.compareWith"
          [granularity]="config.granularity"
          [bounds]="config.bounds"
          [activePeriod]="config.activePeriod"
          [selection]="config.selection"
          [showReset]="config.showReset"
          [dataframePeriod]="config.dataframePeriod"
          [dataframeWeekRange]="config.dataframeWeekRange ?? null"
          [dataframePeriodLabel]="config.dataframePeriodLabel"
          [panelOpen]="openPicker() === 'compare'"
          (panelOpenChange)="onPanelOpenChange('compare', $event)"
          (applied)="onCompareApplied($event)"
          (resetSelection)="onCompareReset()"
        />
      }
    </app-period-bar>
  `,
})
export class DashboardPeriodBarComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly store = inject(DashboardDataStore);
  private readonly periodService = inject(PeriodService);

  protected readonly granularity = this.periodService.granularity;
  protected readonly periodInfo = this.store.chartPeriodBarInfo;
  protected readonly picker = this.store.chartPickerConfig;
  protected readonly comparePicker = this.store.comparePickerConfig;
  protected readonly openPicker = signal<'period' | 'compare' | null>(null);

  constructor() {
    effect(() => {
      this.granularity();
      untracked(() => this.openPicker.set(null));
    });
  }

  onPanelOpenChange(kind: 'period' | 'compare', open: boolean): void {
    this.openPicker.set(open ? kind : null);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.openPicker()) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (this.host.nativeElement.contains(target)) return;
    this.openPicker.set(null);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.openPicker.set(null);
  }

  onApplied(selection: ChartPeriodSelection): void {
    this.periodService.applyChartPeriod(selection);
  }

  onReset(): void {
    this.periodService.resetChartPeriodToLatest();
  }

  onCompareApplied(selection: ChartPeriodSelection): void {
    this.periodService.applyComparePeriod(selection);
  }

  onCompareReset(): void {
    this.periodService.resetComparePeriod();
  }
}
