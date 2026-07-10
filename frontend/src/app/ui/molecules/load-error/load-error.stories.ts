import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { LoadErrorComponent } from './load-error.component';

interface LoadErrorStoryArgs {
  message: string;
}

const meta: Meta<LoadErrorStoryArgs> = {
  title: 'Molecules/LoadError',
  component: LoadErrorComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    message: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<LoadErrorStoryArgs>;

export const Default: Story = {
  args: { message: 'Не удалось загрузить данные' },
  render: (args) => ({
    props: args,
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <app-load-error [message]="message" />
      </div>
    `,
  }),
};
