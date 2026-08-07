import type { Meta, StoryObj } from '@storybook/angular';

import { StatusMetricRowComponent } from './status-metric-row.component';

const meta: Meta<StatusMetricRowComponent> = {
  title: 'Molecules/StatusMetricRow',
  component: StatusMetricRowComponent,
  args: {
    label: 'Продажи',
    value: '22 июл · −1 день',
    hint: '22 июля 2026',
  },
};

export default meta;
type Story = StoryObj<StatusMetricRowComponent>;

export const Default: Story = {};

export const Autosync: Story = {
  args: {
    label: 'Автосинхронизация',
    value: 'включена',
    hint: null,
  },
};
