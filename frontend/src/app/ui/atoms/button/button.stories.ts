import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { ButtonComponent } from './button.component';

type ButtonVariant = 'default' | 'segment-on' | 'pill' | 'primary';

interface ButtonStoryArgs {
  variant: ButtonVariant;
  disabled: boolean;
  block: boolean;
  label: string;
}

const meta: Meta<ButtonStoryArgs> = {
  title: 'Atoms/Button',
  component: ButtonComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'segment-on', 'pill', 'primary'] satisfies ButtonVariant[],
      description: 'В segment-control: default = off, segment-on = выбран',
    },
    disabled: { control: 'boolean' },
    block: { control: 'boolean' },
    label: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<ButtonStoryArgs>;

const segChrome =
  'display:inline-flex;background:var(--card);border:1px solid var(--line);border-radius:11px;padding:3px;gap:2px;';

export const Default: Story = {
  args: {
    variant: 'default',
    disabled: false,
    block: false,
    label: 'Месяц',
  },
  render: (args) => ({
    props: args,
    template: `
      @if (variant === 'default' || variant === 'segment-on') {
        <div style="${segChrome}">
          <app-button variant="default">Неделя</app-button>
          <app-button [variant]="variant" [disabled]="disabled">{{ label }}</app-button>
          <app-button variant="default">Год</app-button>
        </div>
      } @else {
        <div style="${ATOM_DEMO_PANEL}">
          <app-button
            [variant]="variant"
            [disabled]="disabled"
            [block]="block"
          >{{ label }}</app-button>
        </div>
      }
    `,
  }),
};
