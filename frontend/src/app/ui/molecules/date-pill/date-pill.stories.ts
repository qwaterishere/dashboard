import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { DatePillComponent } from './date-pill.component';

interface DatePillStoryArgs {
  label: string;
  note: string;
}

const meta: Meta<DatePillStoryArgs> = {
  title: 'Molecules/DatePill',
  component: DatePillComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    label: { control: 'text' },
    note: { control: 'text', description: 'Пустая строка — note скрыт' },
  },
};

export default meta;
type Story = StoryObj<DatePillStoryArgs>;

export const Default: Story = {
  args: {
    label: '1–30 июня 2026',
    note: '31 день · закрыт',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <app-date-pill [label]="label" [note]="note" />
      </div>
    `,
  }),
};
