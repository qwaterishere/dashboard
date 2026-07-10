import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { TextComponent } from './text.component';

type TextTone = 'default' | 'muted' | 'muted2' | 'caption' | 'danger';

interface TextStoryArgs {
  tone: TextTone;
  text: string;
}

const meta: Meta<TextStoryArgs> = {
  title: 'Atoms/Text',
  component: TextComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    tone: {
      control: 'select',
      options: ['default', 'muted', 'muted2', 'caption', 'danger'] satisfies TextTone[],
    },
    text: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<TextStoryArgs>;

export const Default: Story = {
  args: { tone: 'muted', text: 'к прошлому периоду' },
  render: (args) => ({
    props: args,
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <app-text [tone]="tone">{{ text }}</app-text>
      </div>
    `,
  }),
};
