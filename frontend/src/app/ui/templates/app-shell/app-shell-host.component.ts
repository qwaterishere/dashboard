import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { PopoverController } from '../../../core/state/popover.controller';
import { NavActiveService } from '../../../core/routing/nav-active.service';
import { PeriodService } from '../../../core/services/period.service';
import { pageTitleForSegment } from '../../../shared/constants/nav.constants';
import { buildGreeting } from '../../../shared/utils/greeting.utils';
import { DashboardDataStore } from '../../../features/dashboard/data/dashboard-data.store';
import { DashboardPeriodBarComponent } from '../../../features/dashboard/containers/dashboard-period-bar/dashboard-period-bar.component';
import { DashboardRightPanelComponent } from '../../../features/dashboard/containers/dashboard-right-panel/dashboard-right-panel.component';
import { PeriodBarComponent } from '../../molecules/period-bar/period-bar.component';
import type { PageHeadlineVariant } from '../../molecules/page-greeting/page-greeting.component';
import { AppShellTemplateComponent } from './app-shell-template.component';

const PERIOD_BAR_SEGMENTS = new Set(['dashboard', 'sales', 'warehouse', 'foodcost']);

@Component({
  selector: 'app-shell-host',
  standalone: true,
  imports: [
    AppShellTemplateComponent,
    RouterOutlet,
    PeriodBarComponent,
    DashboardPeriodBarComponent,
    DashboardRightPanelComponent,
  ],
  template: `
    <app-shell-template
      [pageHeadline]="pageHeadline()"
      [pageHeadlineVariant]="pageHeadlineVariant()"
      [showPageHeadline]="showPageHeadline()"
      [showPeriodBar]="showPeriodBar()"
      [sidebarOpen]="sidebarOpen()"
      [showRightPanel]="showRightPanel()"
      (sidebarToggle)="toggleSidebar()"
      (sidebarClose)="closeSidebar()"
      (mainScroll)="onMainScroll()"
    >
      @if (showPeriodBar()) {
        @if (onDashboard()) {
          <app-dashboard-period-bar appPeriodBar />
        } @else {
          <app-period-bar
            appPeriodBar
            [period]="store.period()"
            [(granularity)]="granularity"
          />
        }
      }
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

  protected readonly onDashboard = computed(() => this.navActive.segment() === 'dashboard');

  protected readonly pageHeadline = computed(() => {
    const segment = this.navActive.segment() ?? '';
    if (segment === 'dashboard') {
      const user = this.auth.user();
      const name = user?.first_name ?? 'коллега';
      return buildGreeting(name);
    }
    return pageTitleForSegment(segment) ?? '';
  });

  protected readonly pageHeadlineVariant = computed<PageHeadlineVariant>(() =>
    this.navActive.segment() === 'dashboard' ? 'greeting' : 'title',
  );

  protected readonly showPageHeadline = computed(() => {
    const segment = this.navActive.segment() ?? '';
    if (segment === 'dashboard') return true;
    return pageTitleForSegment(segment) !== null;
  });

  protected readonly showRightPanel = computed(() => this.navActive.segment() === 'dashboard');

  protected readonly showPeriodBar = computed(() =>
    PERIOD_BAR_SEGMENTS.has(this.navActive.segment() ?? ''),
  );

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
