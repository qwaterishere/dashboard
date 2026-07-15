import { Component, input } from '@angular/core';

import { HeadingComponent } from '../../atoms/heading/heading.component';
import { LflBadgeComponent } from '../../atoms/lfl-badge/lfl-badge.component';
import { PopoverTriggerDirective } from '../../directives/popover-trigger.directive';
import { FmtPipe, MoneyPipe } from '../../../shared/pipes/format.pipes';
import type { DetailPopover } from '../../../shared/models';

@Component({
  selector: 'app-kpi-value',
  standalone: true,
  imports: [HeadingComponent, LflBadgeComponent, PopoverTriggerDirective, FmtPipe, MoneyPipe],
  template: `
    <div class="k-val">
      @if (format() === 'money') {
        <app-heading [level]="1" variant="big" [text]="value() | money" />
      } @else {
        <app-heading [level]="1" variant="big" [text]="value() | fmt" />
      }
      <div class="k-val__lfl">
        @if (lflPct() !== undefined && lflDir()) {
          @if (lflLoading()) {
            <app-lfl-badge
              [pct]="lflPct()!"
              [direction]="lflDir()!"
              [label]="comparisonLabel()"
              [isLoading]="true"
            />
          } @else {
            <app-lfl-badge
              [pct]="lflPct()!"
              [direction]="lflDir()!"
              [label]="comparisonLabel()"
              [appPopoverTrigger]="lflPopoverKey()"
              [popoverDetails]="popoverDetails()"
            />
          }
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
      max-width: 100%;
    }

    .k-val {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      margin-top: 10px;
      min-width: 0;
      max-width: 100%;
    }

    .k-val__lfl {
      display: flex;
      align-items: center;
      min-height: var(--kpi-lfl-slot-height);
      height: var(--kpi-lfl-slot-height);
    }
  `,
})
export class KpiValueComponent {
  readonly value = input.required<number>();
  readonly format = input<'money' | 'number'>('money');
  readonly lflPct = input<number>();
  readonly lflDir = input<'up' | 'dn'>();
  readonly comparisonLabel = input<'LfL' | 'WoW'>('LfL');
  readonly lflLoading = input(false);
  readonly lflPopoverKey = input<string | undefined>();
  readonly popoverDetails = input<Record<string, DetailPopover>>({});
}
