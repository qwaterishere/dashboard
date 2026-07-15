import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { DataFreshness } from '../../../shared/models/data-freshness.model';
import { buildFreshnessBanner } from '../../../core/data/data-freshness.utils';

@Component({
  selector: 'app-data-freshness-banner',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (view().visible) {
      <div class="freshness-banner" [class]="toneClass()" role="status">
        <span>{{ view().message }}</span>
        @if (view().showSettingsLink) {
          <a routerLink="/settings" fragment="iiko-sync" class="freshness-banner__link">Настройки</a>
        }
      </div>
    }
  `,
  styles: `
    .freshness-banner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      margin: 0 0 16px;
      padding: 10px 14px;
      border-radius: 11px;
      font-size: 0.82rem;
      font-weight: 600;
      line-height: 1.35;
    }

    .freshness-banner--info {
      background: rgba(74, 144, 226, 0.12);
      border: 1px solid rgba(74, 144, 226, 0.35);
      color: var(--txt);
    }

    .freshness-banner--warn {
      background: rgba(255, 193, 7, 0.12);
      border: 1px solid rgba(255, 193, 7, 0.35);
      color: var(--txt);
    }

    .freshness-banner--error {
      background: rgba(255, 107, 107, 0.12);
      border: 1px solid rgba(255, 107, 107, 0.35);
      color: var(--red);
    }

    .freshness-banner__link {
      color: inherit;
      text-decoration: underline;
      text-underline-offset: 2px;
      white-space: nowrap;
    }
  `,
})
export class DataFreshnessBannerComponent {
  readonly freshness = input<DataFreshness | null>(null);

  protected readonly view = computed(() => buildFreshnessBanner(this.freshness()));

  protected readonly toneClass = computed(() => {
    const tone = this.view().tone;
    return `freshness-banner--${tone}`;
  });
}
