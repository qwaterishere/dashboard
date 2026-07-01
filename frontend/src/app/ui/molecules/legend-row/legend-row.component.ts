import { Component, input } from '@angular/core';

import { DotComponent } from '../../atoms/dot/dot.component';

@Component({
  selector: 'app-legend-row',
  standalone: true,
  imports: [DotComponent],
  template: `
    <div class="lg-row">
      <app-dot [color]="color()" />
      <span class="lg-name">
        {{ name() }}
        @if (caption()) {
          <small>{{ caption() }}</small>
        }
      </span>
      <span class="lg-vals">
        <ng-content />
      </span>
    </div>
  `,
  styles: `
    .lg-row {
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 10px;
      font-size: 0.82rem;
    }
    .lg-name small {
      display: block;
      color: var(--mut2);
      font-size: 0.72rem;
      font-weight: 500;
    }
    .lg-vals { text-align: right; font-weight: 700; }
  `,
})
export class LegendRowComponent {
  readonly name = input.required<string>();
  readonly color = input('#3DDC97');
  readonly caption = input('');
}
