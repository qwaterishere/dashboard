import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { DashboardDataStore } from '../../../features/dashboard/data/dashboard-data.store';
import { NavActiveService } from '../../../core/routing/nav-active.service';
import { PageGreetingComponent } from '../../molecules/page-greeting/page-greeting.component';
import { PeriodBarComponent } from '../../molecules/period-bar/period-bar.component';
import { SidebarOrganismComponent } from '../../organisms/sidebar/sidebar-organism.component';
import { DashboardRightPanelComponent } from '../../../features/dashboard/pages/dashboard-right-panel/dashboard-right-panel.component';

@Component({
  selector: 'app-shell-template',
  standalone: true,
  imports: [
    RouterOutlet,
    SidebarOrganismComponent,
    PageGreetingComponent,
    PeriodBarComponent,
    DashboardRightPanelComponent,
  ],
  template: `
    <button type="button" class="nav-toggle" (click)="toggleSidebar()" aria-label="Меню">
      ☰
    </button>
    @if (sidebarOpen()) {
      <button type="button" class="sidebar-backdrop" (click)="closeSidebar()" aria-label="Закрыть меню"></button>
    }
    <div class="app">
      <app-sidebar-organism class="app-sidebar" [class.open]="sidebarOpen()" />
      <main class="app-main">
        <app-page-greeting />
        <app-period-bar
          [period]="store.period()"
          [granularity]="store.granularity()"
          (granularityChange)="onGranularityChange($event)"
        />
        <div class="page-body">
          <router-outlet />
        </div>
      </main>
      @if (showDashboardPanel()) {
        <app-dashboard-right-panel />
      }
    </div>
  `,
  styleUrl: './app-shell-template.component.scss',
})
export class AppShellTemplateComponent {
  protected readonly store = inject(DashboardDataStore);
  protected readonly sidebarOpen = signal(false);

  private readonly navActive = inject(NavActiveService);
  protected readonly showDashboardPanel = computed(() => this.navActive.segment() === 'dashboard');

  onGranularityChange(value: 'week' | 'month' | 'year'): void {
    this.store.granularity.set(value);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
