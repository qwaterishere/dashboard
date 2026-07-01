import { Component, input, model } from '@angular/core';

import type { PeriodGranularity, PeriodInfo } from '../../../shared/models/common.model';
import { PERIOD_GRANULARITY_OPTIONS } from '../../../shared/constants/period.constants';
import { SegmentControlComponent } from '../segment-control/segment-control.component';
import { DatePillComponent } from '../date-pill/date-pill.component';
import { ComparePillComponent } from '../compare-pill/compare-pill.component';

@Component({
  selector: 'app-period-bar',
  standalone: true,
  imports: [SegmentControlComponent, DatePillComponent, ComparePillComponent],
  template: `
    <div class="period-bar">
      <app-segment-control [options]="granularityOptions" [(value)]="granularity" />
      <app-date-pill [label]="period().label" [note]="period().note" />
      @if (period().compareWith) {
        <app-compare-pill [compareWith]="period().compareWith!" />
      }
    </div>
  `,
  styleUrl: './period-bar.component.scss',
})
export class PeriodBarComponent {
  readonly period = input.required<PeriodInfo>();
  readonly granularity = model<PeriodGranularity>('month');

  protected readonly granularityOptions = PERIOD_GRANULARITY_OPTIONS;
}
