import { Component, input } from '@angular/core';

import type { LflDirection } from '../../../shared/models';
import { SignedPctPipe } from '../../../shared/pipes/format.pipes';

@Component({
  selector: 'app-lfl-badge',
  standalone: true,
  host: {
    '[class.inverted]': 'inverted()',
  },
  imports: [SignedPctPipe],
  template: `
    <span class="lfl" [class.up]="direction() === 'up'" [class.dn]="direction() === 'dn'">
      LfL {{ pct() | signedPct }}
    </span>
  `,
  styles: `
    :host {
      flex-shrink: 0;
    }

    .lfl {
      font-size: 0.72rem;
      font-weight: 700;
      border-radius: 99px;
      padding: 3px 9px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }
    .lfl.up {
      background: rgba(61, 220, 151, 0.13);
      color: var(--grn);
      box-shadow: inset 0 0 0 1px rgba(61, 220, 151, 0.35);
    }
    .lfl.dn {
      background: rgba(255, 107, 107, 0.12);
      color: var(--red);
      box-shadow: inset 0 0 0 1px rgba(255, 107, 107, 0.3);
    }

    :host(.inverted) .lfl.up {
      background: rgba(255, 107, 107, 0.12);
      color: var(--red);
      box-shadow: inset 0 0 0 1px rgba(255, 107, 107, 0.3);
    }

    :host(.inverted) .lfl.dn {
      background: rgba(61, 220, 151, 0.13);
      color: var(--grn);
      box-shadow: inset 0 0 0 1px rgba(61, 220, 151, 0.35);
    }
  `,
})
export class LflBadgeComponent {
  readonly pct = input.required<number>();
  readonly direction = input<LflDirection>('up');
  /** Фудкост: рост — плохо, снижение — хорошо. */
  readonly inverted = input(false);
}
