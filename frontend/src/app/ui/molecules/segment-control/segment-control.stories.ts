import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { SegmentControlComponent } from './segment-control.component';
import type { PeriodGranularity } from '../../../shared/models/common.model';

interface SegmentControlStoryArgs {
  value: PeriodGranularity;
  size: 'default' | 'sm';
  tone: 'default' | 'foodcost';
}

const OPTIONS = [
  { value: 'week' as const, label: 'Неделя' },
  { value: 'month' as const, label: 'Месяц' },
  { value: 'year' as const, label: 'Год' },
];

const meta: Meta<SegmentControlStoryArgs> = {
  title: 'Molecules/SegmentControl',
  component: SegmentControlComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    value: { control: 'select', options: ['week', 'month', 'year'] },
    size: { control: 'select', options: ['default', 'sm'] },
    tone: { control: 'select', options: ['default', 'foodcost'] },
  },
};

export default meta;
type Story = StoryObj<SegmentControlStoryArgs>;

export const Default: Story = {
  args: {
    value: 'month',
    size: 'default',
    tone: 'default',
  },
  render: (args) => ({
    props: { ...args, options: OPTIONS },
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <app-segment-control
          [options]="options"
          [(value)]="value"
          [size]="size"
          [tone]="tone"
        />
      </div>
    `,
  }),
};
