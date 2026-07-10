import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_FIELD } from '../../storybook/demo-frame';
import { FieldInputComponent } from './field-input.component';

interface FieldInputStoryArgs {
  type: 'text' | 'email' | 'password';
  placeholder: string;
  invalid: boolean;
  disabled: boolean;
}

const meta: Meta<FieldInputStoryArgs> = {
  title: 'Atoms/FieldInput',
  component: FieldInputComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    type: { control: 'select', options: ['text', 'email', 'password'] },
    placeholder: { control: 'text' },
    invalid: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<FieldInputStoryArgs>;

export const Default: Story = {
  args: {
    type: 'email',
    placeholder: 'Электронная почта',
    invalid: false,
    disabled: false,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="${ATOM_DEMO_FIELD}">
        <app-field-input
          inputId="demo-field"
          name="demo"
          [type]="type"
          [placeholder]="placeholder"
          [invalid]="invalid"
          [disabled]="disabled"
          autocomplete="email"
        />
      </div>
    `,
  }),
};
