import type { Meta, StoryObj } from '@storybook/angular';

import { MOLECULE_DEMO_WIDE } from '../../storybook/demo-frame';
import { BarRowComponent } from './bar-row.component';

interface BarRowStoryArgs {
  name: string;
  variant: 'single' | 'dual-rev-gp';
  widthPct: number;
  revWidth: number;
  gpWidth: number;
  valueLabel: string;
}

const meta: Meta<BarRowStoryArgs> = {
  title: 'Molecules/BarRow',
  component: BarRowComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    name: { control: 'text' },
    variant: { control: 'select', options: ['single', 'dual-rev-gp'] },
    widthPct: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    revWidth: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    gpWidth: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    valueLabel: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<BarRowStoryArgs>;

export const Default: Story = {
  args: {
    name: 'Горячие блюда из мяса и птицы',
    variant: 'single',
    widthPct: 72,
    revWidth: 80,
    gpWidth: 55,
    valueLabel: '412 000 ₽',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="${MOLECULE_DEMO_WIDE}">
        @if (variant === 'single') {
          <app-bar-row
            [name]="name"
            variant="single"
            [widthPct]="widthPct"
          >
            <span class="br-r">{{ valueLabel }}</span>
          </app-bar-row>
        } @else {
          <app-bar-row
            [name]="name"
            variant="dual-rev-gp"
            [revWidth]="revWidth"
            [gpWidth]="gpWidth"
            revLabel="1,2 млн"
            gpLabel="480 тыс"
            shareLabel="12,4 % от выручки"
          />
        }
      </div>
    `,
  }),
};
