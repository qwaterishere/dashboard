import { Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { APP_PERIOD } from '../../../shared/constants/period.constants';
import { PeriodChromeService } from '../../../core/state/period-chrome.service';
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
    <div class="app">
      <app-sidebar-organism class="app-sidebar" />
      <main class="app-main">
        <app-page-greeting />
        <app-period-bar
          [period]="period"
          [granularity]="periodChrome.granularity()"
          (granularityChange)="periodChrome.granularity.set($event)"
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
  protected readonly period = APP_PERIOD;
  protected readonly periodChrome = inject(PeriodChromeService);

  private readonly navActive = inject(NavActiveService);
  protected readonly showDashboardPanel = computed(() => this.navActive.segment() === 'dashboard');
}
