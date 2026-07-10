import type { Meta, StoryObj } from '@storybook/angular';

import { MOLECULE_DEMO_WIDE } from '../../storybook/demo-frame';
import { LegendRowComponent } from './legend-row.component';

interface LegendRowStoryArgs {
  name: string;
  color: string;
  caption: string;
  layout: 'default' | 'sales-dual' | 'warehouse';
  value: string;
  revValue: string;
  gpValue: string;
}

const meta: Meta<LegendRowStoryArgs> = {
  title: 'Molecules/LegendRow',
  component: LegendRowComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    name: { control: 'text' },
    color: { control: 'color' },
    caption: { control: 'text', description: 'Подпись под названием' },
    layout: { control: 'select', options: ['default', 'sales-dual', 'warehouse'] },
    value: { control: 'text', description: 'Для layout default / warehouse' },
    revValue: { control: 'text', description: 'Для layout sales-dual' },
    gpValue: { control: 'text', description: 'Для layout sales-dual' },
  },
};

export default meta;
type Story = StoryObj<LegendRowStoryArgs>;

export const Default: Story = {
  args: {
    name: 'Кухня',
    color: '#3DDC97',
    caption: '42% выручки',
    layout: 'default',
    value: '3,4 млн ₽',
    revValue: '3,4 млн',
    gpValue: '38%',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="${MOLECULE_DEMO_WIDE}">
        <app-legend-row
          [name]="name"
          [color]="color"
          [caption]="caption"
          [layout]="layout"
        >
          @if (layout === 'sales-dual') {
            <span class="lg-r">{{ revValue }}</span>
            <span class="lg-g">{{ gpValue }}</span>
          } @else {
            {{ value }}
          }
        </app-legend-row>
      </div>
    `,
  }),
};
