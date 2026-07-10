import { Component, computed, inject, input } from '@angular/core';

import { NavActiveService } from '../../../core/routing/nav-active.service';
import { ThemeService } from '../../../core/state/theme.service';
import {
  MAIN_NAV_ITEMS,
  SECONDARY_NAV_ITEMS,
  type NavItemConfig,
} from '../../../shared/constants/nav.constants';
import { NavItemComponent } from '../../molecules/nav-item/nav-item.component';
import { ThemeToggleComponent } from '../../molecules/theme-toggle/theme-toggle.component';
import { DividerComponent } from '../../atoms/divider/divider.component';

@Component({
  selector: 'app-sidebar-organism',
  standalone: true,
  imports: [NavItemComponent, ThemeToggleComponent, DividerComponent],
  template: `
    <aside class="side">
      <div class="logo">СЕЗОНЫ<span>.</span></div>
      <nav class="nav">
        @for (item of mainNav(); track item.path) {
          <app-nav-item
            [path]="item.path"
            [label]="item.label"
            [badge]="item.badge"
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
        <app-theme-toggle [isDark]="isDark()" (toggled)="onThemeToggle()" />
      </div>
    </aside>
  `,
  styleUrl: './sidebar-organism.component.scss',
})
export class SidebarOrganismComponent {
  private readonly navActive = inject(NavActiveService);
  private readonly themeService = inject(ThemeService);

  readonly mainNav = input<NavItemConfig[]>(MAIN_NAV_ITEMS);
  readonly secondaryNav = input<NavItemConfig[]>(SECONDARY_NAV_ITEMS);

  protected readonly isDark = computed(() => this.themeService.theme() === 'dark');

  isActive(path: string): boolean {
    const expected = path.replace(/^\//, '');
    return this.navActive.segment() === expected;
  }

  onThemeToggle(): void {
    this.themeService.toggle();
  }
}
