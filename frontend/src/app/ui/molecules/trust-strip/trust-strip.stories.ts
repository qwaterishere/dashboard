import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig } from '@storybook/angular';
import { provideRouter } from '@angular/router';

import type { TrustStripVm } from '../../../shared/utils/restaurant-attention.utils';
import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { TrustStripComponent } from './trust-strip.component';

const meta: Meta<TrustStripComponent> = {
  title: 'Molecules/TrustStrip',
  component: TrustStripComponent,
  decorators: [
    applicationConfig({
      providers: [provideRouter([])],
    }),
  ],
  render: (args) => ({
    props: args,
    template: `<div style="${ATOM_DEMO_PANEL}"><app-trust-strip [trust]="trust" [loading]="loading" /></div>`,
  }),
};

export default meta;
type Story = StoryObj<TrustStripComponent>;

const base = (partial: Partial<TrustStripVm> = {}): TrustStripVm => ({
  headline: 'Данные актуальны',
  tone: 'ok',
  pulsing: false,
  expanded: false,
  compactLabel: 'Актуально на 22 июля',
  progressPercent: null,
  progressLabel: null,
  cta: { kind: 'sync', label: 'Обновить', disabled: false },
  ...partial,
});

export const CompactOk: Story = {
  args: { trust: base(), loading: false },
};

export const ExpandedStale: Story = {
  args: {
    trust: base({
      expanded: true,
      tone: 'warn',
      headline: 'Данные отстают',
      compactLabel: 'Данные отстают',
    }),
    loading: false,
  },
};

export const Syncing: Story = {
  args: {
    trust: base({
      expanded: true,
      tone: 'warn',
      pulsing: true,
      headline: 'Идёт синхронизация',
      progressPercent: 58,
      progressLabel: 'Склад',
      cta: { kind: 'sync', label: 'Обновление…', disabled: true },
    }),
    loading: false,
  },
};

export const Unconfigured: Story = {
  args: {
    trust: base({
      expanded: true,
      tone: 'warn',
      headline: 'iiko не подключён',
      cta: { kind: 'configure', label: 'Подключить iiko', disabled: false },
    }),
    loading: false,
  },
};

export const Retry: Story = {
  args: {
    trust: base({
      expanded: true,
      tone: 'warn',
      headline: 'Статус неизвестен',
      compactLabel: 'Статус неизвестен',
      cta: { kind: 'retry', label: 'Повторить', disabled: false },
    }),
    loading: false,
  },
};

export const Loading: Story = {
  args: { trust: null, loading: true },
};
