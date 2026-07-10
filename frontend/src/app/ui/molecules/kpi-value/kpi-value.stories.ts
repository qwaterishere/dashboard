import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { KpiValueComponent } from './kpi-value.component';

interface KpiValueStoryArgs {
  value: number;
  format: 'money' | 'number';
  showLfl: boolean;
  lflPct: number;
  lflDir: 'up' | 'dn';
}

const meta: Meta<KpiValueStoryArgs> = {
  title: 'Molecules/KpiValue',
  component: KpiValueComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    value: { control: { type: 'number', min: 0, step: 1000 } },
    format: { control: 'select', options: ['money', 'number'] },
    showLfl: { control: 'boolean' },
    lflPct: { control: { type: 'number', step: 0.1 } },
    lflDir: { control: 'select', options: ['up', 'dn'] },
  },
};

export default meta;
type Story = StoryObj<KpiValueStoryArgs>;

export const Default: Story = {
  args: {
    value: 8144000,
    format: 'money',
    showLfl: true,
    lflPct: 12.4,
    lflDir: 'up',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <app-kpi-value
          [value]="value"
          [format]="format"
          [lflPct]="showLfl ? lflPct : undefined"
          [lflDir]="showLfl ? lflDir : undefined"
        />
      </div>
    `,
  }),
};
