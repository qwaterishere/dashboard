import { Component, input } from '@angular/core';

import { DotComponent } from '../../atoms/dot/dot.component';

@Component({
  selector: 'app-legend-row',
  standalone: true,
  imports: [DotComponent],
  host: {
    '[class.lg-row-host--sales]': 'layout() === "sales-dual"',
    '[class.lg-row-host--warehouse]': 'layout() === "warehouse"',
  },
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

    :host(.lg-row-host--sales) .lg-vals {
      display: flex;
      gap: 40px;
    }

    :host(.lg-row-host--sales) ::ng-deep .lg-r {
      min-width: 96px;
      display: inline-block;
      text-align: right;
    }

    :host(.lg-row-host--sales) ::ng-deep .lg-g {
      min-width: 96px;
      display: inline-block;
      text-align: right;
      color: var(--grn);
    }

    :host(.lg-row-host--sales) .lg-row,
    :host(.lg-row-host--warehouse) .lg-row {
      padding: 11px 0;
      border-bottom: 1px solid #1b2236;
      cursor: default;
    }

    :host(.lg-row-host--sales):last-child .lg-row,
    :host(.lg-row-host--warehouse):last-child .lg-row {
      border-bottom: 0;
    }
  `,
})
export class LegendRowComponent {
  readonly name = input.required<string>();
  readonly color = input('#3DDC97');
  readonly caption = input('');
  readonly layout = input<'default' | 'sales-dual' | 'warehouse'>('default');
}
