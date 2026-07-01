import { Component, input } from '@angular/core';

import { NavItemComponent } from '../../molecules/nav-item/nav-item.component';
import { ThemeToggleComponent } from '../../molecules/theme-toggle/theme-toggle.component';
import { DividerComponent } from '../../atoms/divider/divider.component';

interface NavItemConfig {
  path: string;
  label: string;
  badge?: string;
}

@Component({
  selector: 'app-sidebar-organism',
  standalone: true,
  imports: [NavItemComponent, ThemeToggleComponent, DividerComponent],
  template: `
    <aside class="side">
      <div class="logo">СЕЗОНЫ<span>.</span></div>
      <nav class="nav">
        @for (item of mainNav(); track item.path) {
          <app-nav-item [path]="item.path" [label]="item.label" [badge]="item.badge" />
        }
        <app-divider variant="nav" />
        @for (item of secondaryNav(); track item.path) {
          <app-nav-item [path]="item.path" [label]="item.label" />
        }
      </nav>
      <div class="side-bottom">
        <app-theme-toggle />
      </div>
    </aside>
  `,
  styleUrl: './sidebar-organism.component.scss',
})
export class SidebarOrganismComponent {
  readonly mainNav = input<NavItemConfig[]>([
    { path: '/dashboard', label: 'Дашборд' },
    { path: '/sales', label: 'Продажи' },
    { path: '/warehouse', label: 'Склад' },
    { path: '/purchases', label: 'Закупки' },
    { path: '/foodcost', label: 'Фудкост', badge: '3' },
  ]);

  readonly secondaryNav = input<NavItemConfig[]>([
    { path: '/settings', label: 'Настройки' },
    { path: '/support', label: 'Поддержка' },
  ]);
}
