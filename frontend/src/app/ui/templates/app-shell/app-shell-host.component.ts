import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { DataFreshnessService } from '../../../core/data/data-freshness.service';
import { PopoverController } from '../../../core/state/popover.controller';
import { NavActiveService } from '../../../core/routing/nav-active.service';
import { pageTitleForSegment } from '../../../shared/constants/nav.constants';
import { buildGreeting } from '../../../shared/utils/greeting.utils';
import { DashboardPeriodBarComponent } from '../../../features/dashboard/containers/dashboard-period-bar/dashboard-period-bar.component';
import { SalesPeriodBarComponent } from '../../../features/sales/containers/sales-period-bar/sales-period-bar.component';
import { TargetsPeriodBarComponent } from '../../../features/targets/containers/targets-period-bar/targets-period-bar.component';
import { WarehousePeriodBarComponent } from '../../../features/warehouse/containers/warehouse-period-bar/warehouse-period-bar.component';
import { ShellRightPanelComponent } from '../../../features/shell/containers/shell-right-panel/shell-right-panel.component';
import type { PageHeadlineVariant } from '../../molecules/page-greeting/page-greeting.component';
import { DataFreshnessBannerComponent } from '../../molecules/data-freshness-banner/data-freshness-banner.component';
import { AppShellTemplateComponent } from './app-shell-template.component';

const PERIOD_BAR_SEGMENTS = new Set(['dashboard', 'sales', 'warehouse', 'foodcost', 'targets']);

/** Правая панель — общий chrome: профиль + состояние приложения. */
const RIGHT_PANEL_SEGMENTS = new Set([
  'dashboard',
  'sales',
  'warehouse',
  'foodcost',
  'targets',
  'settings',
  'support',
]);

@Component({
  selector: 'app-shell-host',
  standalone: true,
  imports: [
    AppShellTemplateComponent,
    RouterOutlet,
    DashboardPeriodBarComponent,
    SalesPeriodBarComponent,
    TargetsPeriodBarComponent,
    WarehousePeriodBarComponent,
    ShellRightPanelComponent,
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
      [attentionOpen]="attentionOpen()"
      (sidebarToggle)="toggleSidebar()"
      (sidebarClose)="closeSidebar()"
      (attentionToggle)="toggleAttention()"
      (attentionClose)="closeAttention()"
      (mainScroll)="onMainScroll()"
    >
      @if (showPeriodBar()) {
        <app-data-freshness-banner [freshness]="dataFreshness()" appFreshnessBanner />
      }
      @if (showPeriodBar()) {
        @if (isSales()) {
          <app-sales-period-bar appPeriodBar />
        } @else if (isTargets()) {
          <app-targets-period-bar appPeriodBar />
        } @else if (isWarehouse()) {
          <app-warehouse-period-bar appPeriodBar />
        } @else {
          <app-dashboard-period-bar appPeriodBar />
        }
      }
      <router-outlet />
      @if (showRightPanel()) {
        <app-shell-right-panel shellRight />
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
  protected readonly attentionOpen = signal(false);

  protected readonly isSales = computed(() => this.navActive.segment() === 'sales');

  protected readonly isTargets = computed(() => this.navActive.segment() === 'targets');

  protected readonly isWarehouse = computed(() => this.navActive.segment() === 'warehouse');
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

  protected readonly showRightPanel = computed(() =>
    RIGHT_PANEL_SEGMENTS.has(this.navActive.segment() ?? ''),
  );

  protected readonly showPeriodBar = computed(() =>
    PERIOD_BAR_SEGMENTS.has(this.navActive.segment() ?? ''),
  );

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
    if (this.sidebarOpen()) this.attentionOpen.set(false);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  toggleAttention(): void {
    this.attentionOpen.update((open) => !open);
    if (this.attentionOpen()) this.sidebarOpen.set(false);
  }

  closeAttention(): void {
    this.attentionOpen.set(false);
  }

  onMainScroll(): void {
    this.popovers.hide();
  }
}
