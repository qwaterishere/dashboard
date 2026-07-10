import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { PopoverController } from '../../../core/state/popover.controller';
import { NavActiveService } from '../../../core/routing/nav-active.service';
import { PeriodService } from '../../../core/services/period.service';
import { buildGreeting } from '../../../shared/utils/greeting.utils';
import { DashboardDataStore } from '../../../features/dashboard/data/dashboard-data.store';
import { DashboardRightPanelComponent } from '../../../features/dashboard/containers/dashboard-right-panel/dashboard-right-panel.component';
import { AppShellTemplateComponent } from './app-shell-template.component';

@Component({
  selector: 'app-shell-host',
  standalone: true,
  imports: [AppShellTemplateComponent, RouterOutlet, DashboardRightPanelComponent],
  template: `
    <app-shell-template
      [period]="store.period()"
      [(granularity)]="granularity"
      [greeting]="greeting()"
      [sidebarOpen]="sidebarOpen()"
      [showRightPanel]="showRightPanel()"
      (sidebarToggle)="toggleSidebar()"
      (sidebarClose)="closeSidebar()"
      (mainScroll)="onMainScroll()"
    >
      <router-outlet />
      @if (showRightPanel()) {
        <app-dashboard-right-panel shellRight />
      }
    </app-shell-template>
  `,
})
export class AppShellHostComponent {
  private readonly auth = inject(AuthService);
  protected readonly store = inject(DashboardDataStore);
  private readonly periodService = inject(PeriodService);
  private readonly popovers = inject(PopoverController);
  private readonly navActive = inject(NavActiveService);

  protected readonly sidebarOpen = signal(false);
  protected readonly granularity = this.periodService.granularity;

  protected readonly greeting = computed(() => {
    const user = this.auth.user();
    const name = user?.first_name ?? 'коллега';
    return buildGreeting(name);
  });

  protected readonly showRightPanel = computed(() => this.navActive.segment() === 'dashboard');

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  onMainScroll(): void {
    this.popovers.hide();
  }
}
