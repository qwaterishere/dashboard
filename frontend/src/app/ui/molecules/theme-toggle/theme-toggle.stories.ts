import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { ThemeToggleComponent } from './theme-toggle.component';

interface ThemeToggleStoryArgs {
  isDark: boolean;
  variant: 'pill' | 'icon';
}

const meta: Meta<ThemeToggleStoryArgs> = {
  title: 'Molecules/ThemeToggle',
  component: ThemeToggleComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    isDark: { control: 'boolean' },
    variant: { control: 'inline-radio', options: ['pill', 'icon'] },
  },
};

export default meta;
type Story = StoryObj<ThemeToggleStoryArgs>;

export const Pill: Story = {
  args: { isDark: true, variant: 'pill' },
  render: (args) => ({
    props: { ...args, onToggle: () => undefined },
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <app-theme-toggle [isDark]="isDark" [variant]="variant" (toggled)="onToggle()" />
      </div>
    `,
  }),
};

export const Icon: Story = {
  args: { isDark: false, variant: 'icon' },
  render: (args) => ({
    props: { ...args, onToggle: () => undefined },
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <app-theme-toggle [isDark]="isDark" variant="icon" (toggled)="onToggle()" />
      </div>
    `,
  }),
};
