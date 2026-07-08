import type { Meta, StoryObj } from '@storybook/angular';

import { SegmentControlComponent } from './segment-control.component';

const meta: Meta<SegmentControlComponent> = {
  title: 'Molecules/SegmentControl',
  component: SegmentControlComponent,
};

export default meta;
type Story = StoryObj<SegmentControlComponent>;

export const PeriodGranularity: Story = {
  render: () => ({
    props: {
      options: [
        { value: 'week', label: 'Неделя' },
        { value: 'month', label: 'Месяц' },
        { value: 'year', label: 'Год' },
      ],
      value: 'month',
    },
    template: `
      <app-segment-control
        [options]="options"
        [(value)]="value"
      />
    `,
  }),
};
