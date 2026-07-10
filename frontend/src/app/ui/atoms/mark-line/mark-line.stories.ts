import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_PANEL, ATOM_MARK_TRACK } from '../../storybook/demo-frame';
import { MarkLineComponent } from './mark-line.component';

interface MarkLineStoryArgs {
  variant: 'plan' | 'goal';
  position: number;
  trackHeight: number;
}

const meta: Meta<MarkLineStoryArgs> = {
  title: 'Atoms/MarkLine',
  component: MarkLineComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: { control: 'select', options: ['plan', 'goal'] },
    position: { control: { type: 'range', min: 0, max: 100, step: 0.1 } },
    trackHeight: { control: { type: 'number', min: 4, max: 12 } },
  },
};

export default meta;
type Story = StoryObj<MarkLineStoryArgs>;

export const Default: Story = {
  args: { variant: 'plan', position: 75, trackHeight: 8 },
  render: (args) => ({
    props: args,
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <div style="${ATOM_MARK_TRACK}" [style.height.px]="trackHeight">
          <app-mark-line [variant]="variant" [position]="position" />
        </div>
      </div>
    `,
  }),
};
