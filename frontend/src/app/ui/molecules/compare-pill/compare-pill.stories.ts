import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { ComparePillComponent } from './compare-pill.component';

interface ComparePillStoryArgs {
  compareWith: string;
}

const meta: Meta<ComparePillStoryArgs> = {
  title: 'Molecules/ComparePill',
  component: ComparePillComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    compareWith: { control: 'text', description: 'Период сравнения LfL' },
  },
};

export default meta;
type Story = StoryObj<ComparePillStoryArgs>;

export const Default: Story = {
  args: { compareWith: 'июнь 2025' },
  render: (args) => ({
    props: args,
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <app-compare-pill [compareWith]="compareWith" />
      </div>
    `,
  }),
};
