import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { DataFreshness } from '../../../shared/models/data-freshness.model';
import { buildFreshnessBadge } from '../../../core/data/data-freshness.utils';

@Component({
  selector: 'app-data-freshness-badge',
  standalone: true,
  imports: [RouterLink],
  template: `
    <a
      class="mode"
      [class.mode--ok]="view().dotTone === 'ok'"
      [class.mode--warn]="view().dotTone === 'warn'"
      [class.mode--critical]="view().dotTone === 'critical'"
      routerLink="/settings"
      fragment="iiko-sync"
      [attr.title]="view().title"
      [attr.aria-label]="view().title"
    >
      <span class="dot" [class.dot--pulse]="view().pulsing"></span>
      {{ view().label }}
    </a>
  `,
  styles: `
    .mode {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 0.72rem;
      color: var(--mut);
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 99px;
      padding: 6px 12px;
      cursor: pointer;
      font-family: inherit;
      text-decoration: none;
      max-width: 100%;
      white-space: nowrap;
    }

    .dot {
      flex: none;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: var(--mut2);
      transition: background 0.2s, box-shadow 0.2s;
    }

    .mode--ok .dot {
      background: var(--grn);
      box-shadow: 0 0 8px var(--grn);
    }

    .mode--warn .dot {
      background: #e6a700;
      box-shadow: 0 0 8px rgba(230, 167, 0, 0.55);
    }

    .mode--critical .dot {
      background: var(--red);
      box-shadow: 0 0 8px rgba(255, 107, 107, 0.55);
    }

    .dot--pulse {
      animation: freshness-pulse 1.4s ease-in-out infinite;
    }

    @keyframes freshness-pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.45;
      }
    }
  `,
})
export class DataFreshnessBadgeComponent {
  readonly freshness = input<DataFreshness | null>(null);
  readonly loadError = input(false);

  protected readonly view = computed(() =>
    buildFreshnessBadge(this.freshness(), this.loadError()),
  );
}
