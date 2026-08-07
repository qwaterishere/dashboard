import type { Meta, StoryObj } from '@storybook/angular';
import { applicationConfig } from '@storybook/angular';
import { provideRouter } from '@angular/router';

import { AttentionItemComponent } from './attention-item.component';

const meta: Meta<AttentionItemComponent> = {
  title: 'Molecules/AttentionItem',
  component: AttentionItemComponent,
  decorators: [
    applicationConfig({
      providers: [provideRouter([])],
    }),
  ],
  args: {
    severity: 'warn',
    title: 'Продажи отстают',
    detail: '1 день',
    actionLabel: 'Обновить',
    actionKind: 'sync',
    link: null,
    fragment: null,
  },
};

export default meta;
type Story = StoryObj<AttentionItemComponent>;

export const SyncAction: Story = {};

export const CriticalLink: Story = {
  args: {
    severity: 'critical',
    title: 'Ошибка синхронизации',
    detail: 'Не удалось обновить данные из iiko',
    actionLabel: 'В настройки',
    actionKind: 'link',
    link: '/settings',
    fragment: 'iiko-sync',
  },
};

export const WarehouseDeepLink: Story = {
  args: {
    severity: 'critical',
    title: 'Минусовые остатки',
    detail: '3 поз. · дыра 12 400 ₽',
    actionLabel: 'К складу',
    actionKind: 'link',
    link: '/warehouse',
    fragment: null,
    queryParams: { focus: 'negative' },
  },
};

export const Info: Story = {
  args: {
    severity: 'info',
    title: 'Автообновление выключено',
    detail: 'Данные обновляются вручную',
    actionLabel: 'В настройки',
    actionKind: 'link',
    link: '/settings',
    fragment: 'iiko-sync',
  },
};
