import { Component, input, model, output } from '@angular/core';

import type { PeriodGranularity, PeriodInfo } from '../../../shared/models/common.model';
import {
  PageGreetingComponent,
  type PageHeadlineVariant,
} from '../../molecules/page-greeting/page-greeting.component';
import { SidebarOrganismComponent } from '../../organisms/sidebar/sidebar-organism.component';
import { DetailPopoverOrganismComponent } from '../../organisms/detail-popover/detail-popover-organism.component';

@Component({
  selector: 'app-shell-template',
  standalone: true,
  imports: [SidebarOrganismComponent, DetailPopoverOrganismComponent, PageGreetingComponent],
  template: `
    <button type="button" class="nav-toggle" (click)="sidebarToggle.emit()" aria-label="Меню">
      ☰
    </button>
    @if (showRightPanel()) {
      <button
        type="button"
        class="attention-toggle"
        (click)="attentionToggle.emit()"
        [attr.aria-expanded]="attentionOpen()"
        aria-controls="shell-attention-sheet"
        aria-label="Сейчас важно"
      >
        Сейчас важно
      </button>
    }
    @if (sidebarOpen()) {
      <button
        type="button"
        class="sidebar-backdrop"
        (click)="sidebarClose.emit()"
        aria-label="Закрыть меню"
      ></button>
    }
    @if (attentionOpen()) {
      <button
        type="button"
        class="attention-backdrop"
        (click)="attentionClose.emit()"
        aria-label="Закрыть «Сейчас важно»"
      ></button>
    }
    <div
      class="app"
      [class.app--with-right]="showRightPanel()"
      [class.app--attention-open]="attentionOpen()"
    >
      <app-sidebar-organism
        class="app-sidebar"
        [class.open]="sidebarOpen()"
        [attentionBadges]="attentionBadges()"
      />
      <main class="app-main app-scroll" (scroll)="mainScroll.emit()">
        @if (showPageHeadline()) {
          <app-page-greeting [headline]="pageHeadline()" [variant]="pageHeadlineVariant()" />
        }
        @if (showPeriodBar()) {
          <ng-content select="[appFreshnessBanner]" />
        }
        @if (showPeriodBar()) {
          <ng-content select="[appPeriodBar]" />
        }
        <div class="page-body">
          <ng-content />
        </div>
      </main>
      @if (showRightPanel()) {
        <div
          id="shell-attention-sheet"
          class="attention-sheet"
          [class.attention-sheet--open]="attentionOpen()"
          role="dialog"
          aria-modal="true"
          aria-label="Сейчас важно"
        >
          <div class="attention-sheet__bar">
            <span class="attention-sheet__title">Сейчас важно</span>
            <button
              type="button"
              class="attention-sheet__close"
              (click)="attentionClose.emit()"
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
          <ng-content select="[shellRight]" />
        </div>
      }
    </div>
    <app-detail-popover-organism />
  `,
  styleUrl: './app-shell-template.component.scss',
})
export class AppShellTemplateComponent {
  readonly period = input<PeriodInfo>({ label: '…', note: '' });
  readonly granularity = model<PeriodGranularity>('month');
  readonly pageHeadline = input.required<string>();
  readonly pageHeadlineVariant = input<PageHeadlineVariant>('greeting');
  readonly showPageHeadline = input(true);
  readonly showPeriodBar = input(true);
  readonly sidebarOpen = input(false);
  readonly showRightPanel = input(false);
  readonly attentionOpen = input(false);
  /** path → count attention items (sidebar badges). */
  readonly attentionBadges = input<Readonly<Record<string, number>>>({});

  readonly sidebarToggle = output<void>();
  readonly sidebarClose = output<void>();
  readonly attentionToggle = output<void>();
  readonly attentionClose = output<void>();
  readonly mainScroll = output<void>();
}
