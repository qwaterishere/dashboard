import { Component, input } from '@angular/core';

import { HeadingComponent } from '../../atoms/heading/heading.component';
import { LflBadgeComponent } from '../../atoms/lfl-badge/lfl-badge.component';
import { FmtPipe, MoneyPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-kpi-value',
  standalone: true,
  imports: [HeadingComponent, LflBadgeComponent, FmtPipe, MoneyPipe],
  template: `
    <div class="k-val">
      @if (format() === 'money') {
        <app-heading [level]="1" variant="big">{{ value() | money }}</app-heading>
      } @else {
        <app-heading [level]="1" variant="big">{{ value() | fmt }}</app-heading>
      }
      @if (lflPct() !== undefined && lflDir()) {
        <app-lfl-badge [pct]="lflPct()!" [direction]="lflDir()!" />
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
}
