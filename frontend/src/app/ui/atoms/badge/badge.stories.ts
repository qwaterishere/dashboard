import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { BadgeComponent, type BadgeVariant } from './badge.component';

interface BadgeStoryArgs {
  variant: BadgeVariant;
  label: string;
}

const meta: Meta<BadgeStoryArgs> = {
  title: 'Atoms/Badge',
  component: BadgeComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: {
      control: 'select',
      options: ['tag', 'nav', 'abc'] satisfies BadgeVariant[],
    },
    label: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<BadgeStoryArgs>;

export const Default: Story = {
  args: { variant: 'tag', label: 'Кухня' },
  render: (args) => ({
    props: args,
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <div [style]="variant === 'nav' ? 'display:flex;width:180px' : ''">
          <app-badge [variant]="variant" [label]="label" />
        </div>
      </div>
    `,
  }),
};
