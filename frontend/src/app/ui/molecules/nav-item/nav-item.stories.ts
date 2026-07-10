import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig } from '@storybook/angular';
import { provideRouter } from '@angular/router';

import { MOLECULE_SIDEBAR } from '../../storybook/demo-frame';
import { NavItemComponent } from './nav-item.component';

interface NavItemStoryArgs {
  path: string;
  label: string;
  badge: string;
  active: boolean;
}

const meta: Meta<NavItemStoryArgs> = {
  title: 'Molecules/NavItem',
  component: NavItemComponent,
  parameters: { layout: 'centered' },
  decorators: [
    applicationConfig({
      providers: [provideRouter([])],
    }),
  ],
  argTypes: {
    path: { control: 'text' },
    label: { control: 'text' },
    badge: { control: 'text', description: 'Пустая строка — без badge' },
    active: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<NavItemStoryArgs>;

export const Default: Story = {
  args: {
    path: '/dashboard',
    label: 'Дашборд',
    badge: '',
    active: true,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="${MOLECULE_SIDEBAR}">
        <app-nav-item
          [path]="path"
          [label]="label"
          [badge]="badge || undefined"
          [active]="active"
        />
      </div>
    `,
  }),
};
