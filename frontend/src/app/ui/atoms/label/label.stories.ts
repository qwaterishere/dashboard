import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { LabelComponent } from './label.component';

type LabelTone = 'default' | 'muted' | 'kpi-rev' | 'kpi-check' | 'kpi-guests';

interface LabelStoryArgs {
  tone: LabelTone;
  text: string;
}

const meta: Meta<LabelStoryArgs> = {
  title: 'Atoms/Label',
  component: LabelComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    tone: {
      control: 'select',
      options: ['default', 'muted', 'kpi-rev', 'kpi-check', 'kpi-guests'] satisfies LabelTone[],
    },
    text: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<LabelStoryArgs>;

export const Default: Story = {
  args: { tone: 'kpi-rev', text: 'Выручка' },
  render: (args) => ({
    props: args,
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <app-label [tone]="tone">{{ text }}</app-label>
      </div>
    `,
  }),
};
