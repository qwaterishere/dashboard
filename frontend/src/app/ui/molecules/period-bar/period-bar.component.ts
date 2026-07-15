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
      <ng-content select="[periodDate]">
        <app-date-pill class="period-bar__date" [label]="period().label" [note]="period().note" />
      </ng-content>
      <div
        class="period-bar__compare"
        [class.period-bar__compare--empty]="!period().compareWith && !reserveCompareSlot()"
        [class.period-bar__compare--reserved]="reserveCompareSlot()"
      >
        <ng-content select="[comparePeriod]">
          @if (period().compareWith) {
            <app-compare-pill [compareWith]="period().compareWith!" />
          }
        </ng-content>
      </div>
    </div>
  `,
  styleUrl: './period-bar.component.scss',
})
export class PeriodBarComponent {
  readonly period = input.required<PeriodInfo>();
  readonly granularity = model<PeriodGranularity>('month');
  /** Держит ширину LfL-слота даже без compareWith (dashboard loading). */
  readonly reserveCompareSlot = input(false);

  protected readonly granularityOptions = PERIOD_GRANULARITY_OPTIONS;
}
