import type { Meta, StoryObj } from '@storybook/angular';

import { MOLECULE_DEMO_WIDE } from '../../storybook/demo-frame';
import { PageGreetingComponent } from './page-greeting.component';

interface PageGreetingStoryArgs {
  headline: string;
  variant: 'greeting' | 'title';
}

const meta: Meta<PageGreetingStoryArgs> = {
  title: 'Molecules/PageGreeting',
  component: PageGreetingComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    headline: { control: 'text' },
    variant: { control: 'radio', options: ['greeting', 'title'] },
  },
};

export default meta;
type Story = StoryObj<PageGreetingStoryArgs>;

export const Greeting: Story = {
  args: { headline: 'Добрый день, Алексей', variant: 'greeting' },
  render: (args) => ({
    props: args,
    template: `
      <div style="${MOLECULE_DEMO_WIDE}">
        <app-page-greeting [headline]="headline" [variant]="variant" />
      </div>
    `,
  }),
};

export const PageTitle: Story = {
  args: { headline: 'Продажи', variant: 'title' },
  render: (args) => ({
    props: args,
    template: `
      <div style="${MOLECULE_DEMO_WIDE}">
        <app-page-greeting [headline]="headline" [variant]="variant" />
      </div>
    `,
  }),
};
