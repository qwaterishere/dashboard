import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { AvatarComponent } from './avatar.component';

const meta: Meta<AvatarComponent> = {
  title: 'Atoms/Avatar',
  component: AvatarComponent,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<AvatarComponent>;

export const Default: Story = {
  args: { initials: 'АК' },
  render: (args) => ({
    props: args,
    template: `<div style="${ATOM_DEMO_PANEL}"><app-avatar [initials]="initials" /></div>`,
  }),
};
