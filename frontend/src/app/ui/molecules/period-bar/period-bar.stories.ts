import type { Meta, StoryObj } from '@storybook/angular';

import type { PeriodGranularity, PeriodInfo } from '../../../shared/models/common.model';
import { MOLECULE_DEMO_WIDE } from '../../storybook/demo-frame';
import { PeriodBarComponent } from './period-bar.component';

interface PeriodBarStoryArgs {
  label: string;
  note: string;
  compareWith: string;
  showCompare: boolean;
  granularity: PeriodGranularity;
}

const meta: Meta<PeriodBarStoryArgs> = {
  title: 'Molecules/PeriodBar',
  component: PeriodBarComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    label: { control: 'text' },
    note: { control: 'text' },
    compareWith: { control: 'text' },
    showCompare: { control: 'boolean' },
    granularity: { control: 'select', options: ['week', 'month', 'year'] },
  },
};

export default meta;
type Story = StoryObj<PeriodBarStoryArgs>;

export const Default: Story = {
  args: {
    label: '1–30 июня 2026',
    note: '31 день · закрыт',
    compareWith: 'июнь 2025',
    showCompare: true,
    granularity: 'month',
  },
  render: (args) => ({
    props: {
      granularity: args.granularity,
      period: {
        label: args.label,
        note: args.note,
        compareWith: args.showCompare ? args.compareWith : undefined,
      } satisfies PeriodInfo,
    },
    template: `
      <div style="${MOLECULE_DEMO_WIDE}">
        <app-period-bar [period]="period" [(granularity)]="granularity" />
      </div>
    `,
  }),
};
