import { Component, computed, inject, input } from '@angular/core';

import { NavActiveService } from '../../../core/routing/nav-active.service';
import { DataFreshnessService } from '../../../core/data/data-freshness.service';
import {
  MAIN_NAV_ITEMS,
  SECONDARY_NAV_ITEMS,
  type NavItemConfig,
} from '../../../shared/constants/nav.constants';
import { NavItemComponent } from '../../molecules/nav-item/nav-item.component';
import { DataFreshnessBadgeComponent } from '../../molecules/data-freshness-badge/data-freshness-badge.component';
import { DividerComponent } from '../../atoms/divider/divider.component';

@Component({
  selector: 'app-sidebar-organism',
  standalone: true,
  imports: [NavItemComponent, DataFreshnessBadgeComponent, DividerComponent],
  template: `
    <aside class="side">
      <div class="logo">СЕЗОНЫ<span>.</span></div>
      <nav class="nav">
        @for (item of mainNav(); track item.path) {
          <app-nav-item
            [path]="item.path"
            [label]="item.label"
            [badge]="badgeFor(item.path)"
            [active]="isActive(item.path)"
          />
        }
        <app-divider class="nav-divider" />
        @for (item of secondaryNav(); track item.path) {
          <app-nav-item
            [path]="item.path"
            [label]="item.label"
            [active]="isActive(item.path)"
          />
        }
      </nav>
      <div class="side-bottom">
        @if (showFreshnessBadge()) {
          <app-data-freshness-badge
            [freshness]="freshness()"
            [loadError]="freshnessLoadError()"
          />
        }
      </div>
    </aside>
  `,
  styleUrl: './sidebar-organism.component.scss',
})
export class SidebarOrganismComponent {
  private readonly navActive = inject(NavActiveService);
  private readonly freshnessService = inject(DataFreshnessService);

  readonly mainNav = input<NavItemConfig[]>(MAIN_NAV_ITEMS);
  readonly secondaryNav = input<NavItemConfig[]>(SECONDARY_NAV_ITEMS);
  /** path → count operational attention items for that section. */
  readonly attentionBadges = input<Readonly<Record<string, number>>>({});

  protected readonly freshness = this.freshnessService.freshness;
  protected readonly freshnessLoadError = this.freshnessService.loadError;
  protected readonly showFreshnessBadge = computed(
    () => this.freshness() !== null || this.freshnessLoadError(),
  );

  isActive(path: string): boolean {
    const expected = path.replace(/^\//, '');
    return this.navActive.segment() === expected;
  }

  protected badgeFor(path: string): string | undefined {
    const count = this.attentionBadges()[path] ?? 0;
    return count > 0 ? String(count) : undefined;
  }
}
