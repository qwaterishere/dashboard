import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig } from '@storybook/angular';
import { provideRouter } from '@angular/router';

import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { ProfileBlockComponent } from './profile-block.component';

interface ProfileBlockStoryArgs {
  initials: string;
  name: string;
  role: string;
  showLogout: boolean;
  hasUnread: boolean;
  isDark: boolean;
}

const meta: Meta<ProfileBlockStoryArgs> = {
  title: 'Organisms/ProfileBlock',
  component: ProfileBlockComponent,
  parameters: { layout: 'centered' },
  decorators: [
    applicationConfig({
      providers: [provideRouter([])],
    }),
  ],
  argTypes: {
    initials: { control: 'text' },
    name: { control: 'text' },
    role: { control: 'text' },
    showLogout: { control: 'boolean' },
    hasUnread: { control: 'boolean' },
    isDark: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<ProfileBlockStoryArgs>;

function render(args: ProfileBlockStoryArgs, notifications: unknown[] = []) {
  return {
    props: {
      ...args,
      notifications,
      onLogout: () => undefined,
      onTheme: () => undefined,
    },
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <app-profile-block
          [initials]="initials"
          [name]="name"
          [role]="role"
          [showLogout]="showLogout"
          [hasUnread]="hasUnread"
          [isDark]="isDark"
          [notifications]="notifications"
          (themeToggled)="onTheme()"
          (logout)="onLogout()"
        />
      </div>
    `,
  };
}

export const Default: Story = {
  args: {
    initials: 'АК',
    name: 'Алексей К.',
    role: 'Управляющий',
    showLogout: true,
    hasUnread: false,
    isDark: false,
  },
  render: (args) => render(args),
};

export const DarkTheme: Story = {
  args: {
    initials: 'АК',
    name: 'Алексей К.',
    role: 'Управляющий',
    showLogout: true,
    hasUnread: false,
    isDark: true,
  },
  render: (args) => render(args),
};

export const WithUnread: Story = {
  args: {
    initials: 'АК',
    name: 'Алексей К.',
    role: 'Управляющий',
    showLogout: true,
    hasUnread: true,
    isDark: false,
  },
  render: (args) =>
    render(args, [
      {
        id: 'n1',
        message: 'Склад: минусовые остатки',
        link: '/warehouse',
        fragment: null,
        queryParams: { focus: 'negative' },
      },
    ]),
};
