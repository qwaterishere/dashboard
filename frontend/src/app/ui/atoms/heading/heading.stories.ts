import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { HeadingComponent } from './heading.component';

interface HeadingStoryArgs {
  level: 1 | 2 | 3 | 4;
  variant: 'default' | 'big';
  text: string;
}

const meta: Meta<HeadingStoryArgs> = {
  title: 'Atoms/Heading',
  component: HeadingComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    level: { control: { type: 'select' }, options: [1, 2, 3, 4] },
    variant: { control: 'select', options: ['default', 'big'] },
    text: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<HeadingStoryArgs>;

export const Default: Story = {
  args: { level: 2, variant: 'default', text: 'Структура продаж' },
  render: (args) => ({
    props: args,
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <app-heading [level]="level" [variant]="variant" [text]="text" />
      </div>
    `,
  }),
};
