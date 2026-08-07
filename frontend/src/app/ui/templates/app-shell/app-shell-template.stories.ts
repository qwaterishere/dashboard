import { signal } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideRouter } from '@angular/router';

import { DataFreshnessService } from '../../../core/data/data-freshness.service';
import type { DataFreshness } from '../../../shared/models/data-freshness.model';
import { AppShellTemplateComponent } from './app-shell-template.component';

function freshness(): DataFreshness {
  return {
    status: 'fresh',
    expectedDay: '2026-07-22',
    latestSalesDay: '2026-07-22',
    lagDays: 0,
    lastSyncAt: '2026-07-23T10:00:00.000Z',
    syncStatus: 'success',
    syncError: null,
    autoSyncEnabled: true,
    syncProgressPercent: null,
    syncPhase: null,
    stock: {
      latestDay: '2026-07-22',
      lagDays: 0,
      syncStatus: 'success',
      syncError: null,
      daysDone: null,
    },
  };
}

const rightDemo = `
  <aside
    shellRight
    style="padding:16px;height:100%;box-sizing:border-box;background:var(--surface-right)"
  >
    <strong style="font-size:0.8rem">Right slot</strong>
    <p style="margin:8px 0 0;font-size:0.72rem;color:var(--mut)">Profile + attention</p>
  </aside>
`;

const meta: Meta<AppShellTemplateComponent> = {
  title: 'Templates/AppShell',
  component: AppShellTemplateComponent,
  parameters: { layout: 'fullscreen' },
  decorators: [
    applicationConfig({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        {
          provide: DataFreshnessService,
          useValue: {
            freshness: signal(freshness()),
            loadError: signal(false),
          },
        },
      ],
    }),
    moduleMetadata({
      imports: [AppShellTemplateComponent],
    }),
  ],
};

export default meta;
type Story = StoryObj<AppShellTemplateComponent>;

export const DesktopWithRight: Story = {
  args: {
    pageHeadline: 'Дашборд',
    pageHeadlineVariant: 'title',
    showPageHeadline: true,
    showPeriodBar: false,
    showRightPanel: true,
    sidebarOpen: false,
    attentionOpen: false,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="height:100vh;overflow:hidden">
        <app-shell-template
          [pageHeadline]="pageHeadline"
          [pageHeadlineVariant]="pageHeadlineVariant"
          [showPageHeadline]="showPageHeadline"
          [showPeriodBar]="showPeriodBar"
          [showRightPanel]="showRightPanel"
          [sidebarOpen]="sidebarOpen"
          [attentionOpen]="attentionOpen"
        >
          <div style="padding:8px;font-size:0.85rem">Main content</div>
          ${rightDemo}
        </app-shell-template>
      </div>
    `,
  }),
};

/** Sheet open — shrink viewport / browser width ≤1180 to see overlay layout. */
export const MobileAttentionSheetOpen: Story = {
  args: {
    pageHeadline: 'Дашборд',
    pageHeadlineVariant: 'title',
    showPageHeadline: true,
    showPeriodBar: false,
    showRightPanel: true,
    sidebarOpen: false,
    attentionOpen: true,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="height:100vh;overflow:hidden;max-width:1100px;margin:0 auto;border:1px dashed var(--line)">
        <app-shell-template
          [pageHeadline]="pageHeadline"
          [pageHeadlineVariant]="pageHeadlineVariant"
          [showPageHeadline]="showPageHeadline"
          [showPeriodBar]="showPeriodBar"
          [showRightPanel]="showRightPanel"
          [sidebarOpen]="sidebarOpen"
          [attentionOpen]="attentionOpen"
        >
          <div style="padding:8px;font-size:0.85rem">Main · sheet open (max-width 1100)</div>
          ${rightDemo}
        </app-shell-template>
      </div>
    `,
  }),
};

/** Toggle visible; sheet closed until user clicks «Сейчас важно». */
export const MobileAttentionSheetClosed: Story = {
  args: {
    pageHeadline: 'Склад',
    pageHeadlineVariant: 'title',
    showPageHeadline: true,
    showPeriodBar: false,
    showRightPanel: true,
    sidebarOpen: false,
    attentionOpen: false,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="height:100vh;overflow:hidden;max-width:1100px;margin:0 auto;border:1px dashed var(--line)">
        <app-shell-template
          [pageHeadline]="pageHeadline"
          [pageHeadlineVariant]="pageHeadlineVariant"
          [showPageHeadline]="showPageHeadline"
          [showPeriodBar]="showPeriodBar"
          [showRightPanel]="showRightPanel"
          [sidebarOpen]="sidebarOpen"
          [attentionOpen]="attentionOpen"
        >
          <div style="padding:8px;font-size:0.85rem">
            Main · «Сейчас важно» toggle visible ≤1180
          </div>
          ${rightDemo}
        </app-shell-template>
      </div>
    `,
  }),
};
