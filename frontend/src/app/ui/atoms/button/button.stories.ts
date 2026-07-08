import type { Meta, StoryObj } from '@storybook/angular';

import { ButtonComponent } from './button.component';

const meta: Meta<ButtonComponent> = {
  title: 'Atoms/Button',
  component: ButtonComponent,
};

export default meta;
type Story = StoryObj<ButtonComponent>;

export const Default: Story = {
  render: () => ({
    template: `<app-button>Неделя</app-button>`,
  }),
};

export const SegmentOn: Story = {
  render: () => ({
    template: `<app-button variant="segment-on">Месяц</app-button>`,
  }),
};

export const Pill: Story = {
  render: () => ({
    template: `<app-button variant="pill">Июнь 2026</app-button>`,
  }),
};
