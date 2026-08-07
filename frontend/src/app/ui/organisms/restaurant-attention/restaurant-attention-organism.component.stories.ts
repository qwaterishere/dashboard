import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig, moduleMetadata } from '@storybook/angular';
import { provideRouter } from '@angular/router';

import type { AttentionApi } from '../../../shared/models/attention.model';
import type { DataFreshness } from '../../../shared/models/data-freshness.model';
import { buildRestaurantAttentionVm } from '../../../shared/utils/restaurant-attention.utils';
import { RestaurantAttentionOrganismComponent } from './restaurant-attention-organism.component';

function freshness(partial: Partial<DataFreshness> = {}): DataFreshness {
  const { stock: stockPartial, ...rest } = partial;
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
    ...rest,
    stock: {
      latestDay: '2026-07-22',
      lagDays: 0,
      syncStatus: 'success',
      syncError: null,
      daysDone: null,
      ...(stockPartial ?? {}),
    },
  };
}

function attention(partial: Partial<AttentionApi> = {}): AttentionApi {
  return {
    asOf: '2026-07-22',
    period: { year: 2026, month: 7 },
    domains: {
      stock: 'ready',
      foodcost: 'ready',
      revenue: 'ready',
      targets: 'ready',
    },
    negativeStock: { count: 0, valueAbs: 0 },
    foodcost: {
      cleanPct: 25,
      cleanGoal: 28,
      cleanGoalConfigured: true,
      overGoal: false,
      complimentsFact: 100,
      complimentsGoal: 4000,
      complimentsOver: false,
    },
    revenuePace: { risk: false, fact: 100, pace: 100 },
    monthPlan: { configured: true },
    ...partial,
  };
}

const meta: Meta<RestaurantAttentionOrganismComponent> = {
  title: 'Organisms/RestaurantAttention',
  component: RestaurantAttentionOrganismComponent,
  decorators: [
    applicationConfig({
      providers: [provideRouter([])],
    }),
    moduleMetadata({
      imports: [RestaurantAttentionOrganismComponent],
    }),
  ],
  render: (args) => ({
    props: args,
    template: `<div style="width:252px;padding:16px;background:var(--surface-right)"><app-restaurant-attention-organism [vm]="vm" /></div>`,
  }),
};

export default meta;
type Story = StoryObj<RestaurantAttentionOrganismComponent>;

export const Clean: Story = {
  args: {
    vm: buildRestaurantAttentionVm({
      attention: attention(),
      freshness: freshness(),
      freshnessLoading: false,
      freshnessLoadError: false,
    }),
  },
};

export const NegativeStock: Story = {
  args: {
    vm: buildRestaurantAttentionVm({
      attention: attention({
        negativeStock: { count: 4, valueAbs: 18_200 },
      }),
      freshness: freshness(),
      freshnessLoading: false,
      freshnessLoadError: false,
    }),
  },
};

export const FoodcostOver: Story = {
  args: {
    vm: buildRestaurantAttentionVm({
      attention: attention({
        foodcost: {
          cleanPct: 33.2,
          cleanGoal: 28,
          cleanGoalConfigured: true,
          overGoal: true,
          complimentsFact: 5200,
          complimentsGoal: 4000,
          complimentsOver: true,
        },
        revenuePace: { risk: true, fact: 90, pace: 100 },
        monthPlan: { configured: false },
      }),
      freshness: freshness(),
      freshnessLoading: false,
      freshnessLoadError: false,
    }),
  },
};

export const Syncing: Story = {
  args: {
    vm: buildRestaurantAttentionVm({
      attention: attention(),
      freshness: freshness({
        status: 'syncing',
        syncStatus: 'running',
        syncProgressPercent: 58,
        syncPhase: 'stock',
        lagDays: 1,
      }),
      freshnessLoading: false,
      freshnessLoadError: false,
    }),
  },
};
