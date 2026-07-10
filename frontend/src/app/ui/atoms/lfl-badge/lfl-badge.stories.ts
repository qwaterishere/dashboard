import type { Meta, StoryObj } from '@storybook/angular';

import type { LflDirection } from '../../../shared/models';
import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { LflBadgeComponent } from './lfl-badge.component';

interface LflBadgeStoryArgs {
  pct: number;
  direction: LflDirection;
  inverted: boolean;
}

const meta: Meta<LflBadgeStoryArgs> = {
  title: 'Atoms/LflBadge',
  component: LflBadgeComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    pct: { control: { type: 'number', step: 0.1 } },
    direction: { control: 'select', options: ['up', 'dn'] satisfies LflDirection[] },
    inverted: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<LflBadgeStoryArgs>;

export const Default: Story = {
  args: { pct: 8.4, direction: 'up', inverted: false },
  render: (args) => ({
    props: args,
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <app-lfl-badge [pct]="pct" [direction]="direction" [inverted]="inverted" />
      </div>
    `,
  }),
};
