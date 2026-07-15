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
    <span
      class="lfl"
      [class.up]="direction() === 'up'"
      [class.dn]="direction() === 'dn'"
      [class.lfl--loading]="isLoading()"
      [attr.aria-busy]="isLoading() ? true : null"
    >
      @if (isLoading()) {
        <span class="lfl__spinner" aria-hidden="true"></span>
      }
      {{ label() }} {{ pct() | signedPct }}
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
      justify-content: center;
      gap: 4px;
      white-space: nowrap;
      min-width: var(--lfl-badge-min-width);
      box-sizing: border-box;
    }

    .lfl--loading {
      position: relative;
      color: var(--mut);
      background: rgba(110, 107, 255, 0.08);
      box-shadow: inset 0 0 0 1px rgba(110, 107, 255, 0.22);
    }

    .lfl--loading.up,
    .lfl--loading.dn {
      background: rgba(110, 107, 255, 0.08);
      color: var(--mut);
      box-shadow: inset 0 0 0 1px rgba(110, 107, 255, 0.22);
    }

    .lfl__spinner {
      width: 0.72rem;
      height: 0.72rem;
      border: 1.5px solid var(--mut2);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: lfl-spin 0.75s linear infinite;
      flex-shrink: 0;
    }

    @keyframes lfl-spin {
      to {
        transform: rotate(360deg);
      }
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
  readonly label = input<'LfL' | 'WoW'>('LfL');
  readonly isLoading = input(false);
  /** Фудкост: рост — плохо, снижение — хорошо. */
  readonly inverted = input(false);
}
