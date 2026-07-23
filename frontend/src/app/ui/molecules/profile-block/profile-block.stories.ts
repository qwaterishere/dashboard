import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { ProfileBlockComponent } from './profile-block.component';

interface ProfileBlockStoryArgs {
  initials: string;
  name: string;
  role: string;
  showLogout: boolean;
  hasUnread: boolean;
}

const meta: Meta<ProfileBlockStoryArgs> = {
  title: 'Molecules/ProfileBlock',
  component: ProfileBlockComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    initials: { control: 'text' },
    name: { control: 'text' },
    role: { control: 'text' },
    showLogout: { control: 'boolean' },
    hasUnread: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<ProfileBlockStoryArgs>;

export const Default: Story = {
  args: {
    initials: 'АК',
    name: 'Алексей К.',
    role: 'Управляющий',
    showLogout: true,
    hasUnread: false,
  },
  render: (args) => ({
    props: {
      ...args,
      onLogout: () => {
        console.log('logout');
      },
    },
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <app-profile-block
          [initials]="initials"
          [name]="name"
          [role]="role"
          [showLogout]="showLogout"
          [hasUnread]="hasUnread"
          (logout)="onLogout()"
        />
      </div>
    `,
  }),
};
