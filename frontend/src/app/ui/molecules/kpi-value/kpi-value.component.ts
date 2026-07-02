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
      @if (lflPct() !== undefined && lflDir()) {
        <app-lfl-badge
          [pct]="lflPct()!"
          [direction]="lflDir()!"
          [appPopoverTrigger]="lflPopoverKey()"
          [popoverDetails]="popoverDetails()"
        />
      }
    </div>
  `,
  styles: `
    .k-val {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 10px;
      flex-wrap: wrap;
    }
  `,
})
export class KpiValueComponent {
  readonly value = input.required<number>();
  readonly format = input<'money' | 'number'>('money');
  readonly lflPct = input<number>();
  readonly lflDir = input<'up' | 'dn'>();
  readonly lflPopoverKey = input<string | undefined>();
  readonly popoverDetails = input<Record<string, DetailPopover>>({});
}
