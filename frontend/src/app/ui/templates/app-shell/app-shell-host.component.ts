import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { DataFreshnessService } from '../../../core/data/data-freshness.service';
import { PopoverController } from '../../../core/state/popover.controller';
import { NavActiveService } from '../../../core/routing/nav-active.service';
import { pageTitleForSegment } from '../../../shared/constants/nav.constants';
import { buildGreeting } from '../../../shared/utils/greeting.utils';
import { DashboardPeriodBarComponent } from '../../../features/dashboard/containers/dashboard-period-bar/dashboard-period-bar.component';
import { DashboardRightPanelComponent } from '../../../features/dashboard/containers/dashboard-right-panel/dashboard-right-panel.component';
import type { PageHeadlineVariant } from '../../molecules/page-greeting/page-greeting.component';
import { DataFreshnessBannerComponent } from '../../molecules/data-freshness-banner/data-freshness-banner.component';
import { AppShellTemplateComponent } from './app-shell-template.component';

const PERIOD_BAR_SEGMENTS = new Set(['dashboard', 'sales', 'warehouse', 'foodcost', 'targets']);

@Component({
  selector: 'app-shell-host',
  standalone: true,
  imports: [
    AppShellTemplateComponent,
    RouterOutlet,
    DashboardPeriodBarComponent,
    DashboardRightPanelComponent,
    DataFreshnessBannerComponent,
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
        <app-data-freshness-banner [freshness]="dataFreshness()" appFreshnessBanner />
      }
      @if (showPeriodBar()) {
        <app-dashboard-period-bar appPeriodBar />
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
  private readonly popovers = inject(PopoverController);
  private readonly navActive = inject(NavActiveService);
  private readonly freshnessService = inject(DataFreshnessService);

  protected readonly dataFreshness = this.freshnessService.freshness;

  protected readonly sidebarOpen = signal(false);

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
