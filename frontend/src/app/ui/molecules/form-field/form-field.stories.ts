import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_FIELD } from '../../storybook/demo-frame';
import { FormFieldComponent } from './form-field.component';

interface FormFieldStoryArgs {
  label: string;
  inputId: string;
  name: string;
  type: 'text' | 'email' | 'password';
  placeholder: string;
  disabled: boolean;
  required: boolean;
  error: string;
  value: string;
}

const meta: Meta<FormFieldStoryArgs> = {
  title: 'Molecules/FormField',
  component: FormFieldComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    label: { control: 'text' },
    inputId: { control: 'text' },
    name: { control: 'text' },
    type: { control: 'select', options: ['text', 'email', 'password'] },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    required: { control: 'boolean' },
    error: { control: 'text', description: 'Пустая строка — без ошибки' },
    value: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<FormFieldStoryArgs>;

export const Default: Story = {
  args: {
    label: 'Email',
    inputId: 'email-demo',
    name: 'email',
    type: 'email',
    placeholder: 'you@example.com',
    disabled: false,
    required: true,
    error: '',
    value: '',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="${ATOM_DEMO_FIELD}">
        <app-form-field
          [label]="label"
          [inputId]="inputId"
          [name]="name"
          [type]="type"
          [placeholder]="placeholder"
          [disabled]="disabled"
          [required]="required"
          [error]="error || undefined"
          [(value)]="value"
        />
      </div>
    `,
  }),
};
