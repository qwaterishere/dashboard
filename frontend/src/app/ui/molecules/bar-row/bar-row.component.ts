import { Component, input } from '@angular/core';

import { ProgressFillComponent } from '../../atoms/progress-fill/progress-fill.component';
import { ProgressTrackComponent } from '../../atoms/progress-track/progress-track.component';
import type { CategoryKey } from '../../../shared/models';

@Component({
  selector: 'app-bar-row',
  standalone: true,
  imports: [ProgressTrackComponent, ProgressFillComponent],
  template: `
    <div class="bar-row">
      <span class="br-name">{{ name() }}</span>
      <app-progress-track variant="bar">
        <app-progress-fill [width]="widthPct()" [category]="category()" />
      </app-progress-track>
      <span class="br-vals"><ng-content /></span>
    </div>
  `,
  styles: `
    .bar-row {
      display: grid;
      grid-template-columns: 120px 1fr auto;
      align-items: center;
      gap: 12px;
      font-size: 0.78rem;
      margin-bottom: 8px;
    }
    .br-name { color: var(--mut); }
    .br-vals { font-weight: 700; white-space: nowrap; }
  `,
})
export class BarRowComponent {
  readonly name = input.required<string>();
  readonly widthPct = input.required<number>();
  readonly category = input<CategoryKey | null>(null);
}
