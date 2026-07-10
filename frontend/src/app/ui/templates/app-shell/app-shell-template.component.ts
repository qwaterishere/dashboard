import { Component, input, model, output } from '@angular/core';

import type { PeriodGranularity, PeriodInfo } from '../../../shared/models/common.model';
import {
  PageGreetingComponent,
  type PageHeadlineVariant,
} from '../../molecules/page-greeting/page-greeting.component';
import { PeriodBarComponent } from '../../molecules/period-bar/period-bar.component';
import { SidebarOrganismComponent } from '../../organisms/sidebar/sidebar-organism.component';
import { DetailPopoverOrganismComponent } from '../../organisms/detail-popover/detail-popover-organism.component';

@Component({
  selector: 'app-shell-template',
  standalone: true,
  imports: [
    SidebarOrganismComponent,
    DetailPopoverOrganismComponent,
    PageGreetingComponent,
    PeriodBarComponent,
  ],
  template: `
    <button type="button" class="nav-toggle" (click)="sidebarToggle.emit()" aria-label="Меню">
      ☰
    </button>
    @if (sidebarOpen()) {
      <button
        type="button"
        class="sidebar-backdrop"
        (click)="sidebarClose.emit()"
        aria-label="Закрыть меню"
      ></button>
    }
    <div class="app" [class.app--with-right]="showRightPanel()">
      <app-sidebar-organism class="app-sidebar" [class.open]="sidebarOpen()" />
      <main class="app-main" (scroll)="mainScroll.emit()">
        @if (showPageHeadline()) {
          <app-page-greeting [headline]="pageHeadline()" [variant]="pageHeadlineVariant()" />
        }
        @if (showPeriodBar()) {
          <app-period-bar [period]="period()" [(granularity)]="granularity" />
        }
        <div class="page-body">
          <ng-content />
        </div>
      </main>
      @if (showRightPanel()) {
        <ng-content select="[shellRight]" />
      }
    </div>
    <app-detail-popover-organism />
  `,
  styleUrl: './app-shell-template.component.scss',
})
export class AppShellTemplateComponent {
  readonly period = input.required<PeriodInfo>();
  readonly granularity = model<PeriodGranularity>('month');
  readonly pageHeadline = input.required<string>();
  readonly pageHeadlineVariant = input<PageHeadlineVariant>('greeting');
  readonly showPageHeadline = input(true);
  readonly showPeriodBar = input(true);
  readonly sidebarOpen = input(false);
  readonly showRightPanel = input(false);

  readonly sidebarToggle = output<void>();
  readonly sidebarClose = output<void>();
  readonly mainScroll = output<void>();
}
