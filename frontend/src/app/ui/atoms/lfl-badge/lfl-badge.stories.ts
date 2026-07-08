import type { Meta, StoryObj } from '@storybook/angular';

import { LflBadgeComponent } from './lfl-badge.component';

const meta: Meta<LflBadgeComponent> = {
  title: 'Atoms/LflBadge',
  component: LflBadgeComponent,
};

export default meta;
type Story = StoryObj<LflBadgeComponent>;

export const Up: Story = {
  args: { pct: 8.4, direction: 'up' },
};

export const Down: Story = {
  args: { pct: -3.2, direction: 'dn' },
};

export const InvertedUp: Story = {
  args: { pct: 4.2, direction: 'up', inverted: true },
};
