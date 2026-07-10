import type { Meta, StoryObj } from '@storybook/angular';

import { MOLECULE_DEMO_WIDE } from '../../storybook/demo-frame';
import { PageGreetingComponent } from './page-greeting.component';

interface PageGreetingStoryArgs {
  greeting: string;
}

const meta: Meta<PageGreetingStoryArgs> = {
  title: 'Molecules/PageGreeting',
  component: PageGreetingComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    greeting: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<PageGreetingStoryArgs>;

export const Default: Story = {
  args: { greeting: 'Добрый день, Алексей' },
  render: (args) => ({
    props: args,
    template: `
      <div style="${MOLECULE_DEMO_WIDE}">
        <app-page-greeting [greeting]="greeting" />
      </div>
    `,
  }),
};
