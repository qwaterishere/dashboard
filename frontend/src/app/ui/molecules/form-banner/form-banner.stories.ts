import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { FormBannerComponent } from './form-banner.component';

interface FormBannerStoryArgs {
  variant: 'error' | 'success';
  message: string;
}

const meta: Meta<FormBannerStoryArgs> = {
  title: 'Molecules/FormBanner',
  component: FormBannerComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: { control: 'select', options: ['error', 'success'] },
    message: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<FormBannerStoryArgs>;

export const Default: Story = {
  args: {
    variant: 'error',
    message: 'Проверьте корректность заполнения полей',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <app-form-banner [variant]="variant" [message]="message" />
      </div>
    `,
  }),
};
