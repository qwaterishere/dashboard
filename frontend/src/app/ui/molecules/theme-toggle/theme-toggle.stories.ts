import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { ThemeToggleComponent } from './theme-toggle.component';

interface ThemeToggleStoryArgs {
  isDark: boolean;
}

const meta: Meta<ThemeToggleStoryArgs> = {
  title: 'Molecules/ThemeToggle',
  component: ThemeToggleComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    isDark: { control: 'boolean', description: 'Текущая тема (для отображения подписи)' },
  },
};

export default meta;
type Story = StoryObj<ThemeToggleStoryArgs>;

export const Default: Story = {
  args: { isDark: true },
  render: (args) => ({
    props: {
      ...args,
      onToggle: () => {
        console.log('theme toggled');
      },
    },
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <app-theme-toggle [isDark]="isDark" (toggled)="onToggle()" />
      </div>
    `,
  }),
};
