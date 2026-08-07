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
};

export default meta;
type Story = StoryObj<AttentionItemComponent>;

/** Operational cards from GET /api/attention — единственный каталог molecule. */

export const NegativeStock: Story = {
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

export const FoodcostOver: Story = {
  args: {
    severity: 'critical',
    title: 'Фудкост выше цели',
    detail: '33,2% при цели 28,0%',
    actionLabel: 'К фудкосту',
    actionKind: 'link',
    link: '/foodcost',
    fragment: null,
  },
};

export const ComplimentsOver: Story = {
  args: {
    severity: 'warn',
    title: 'Представительские выше цели',
    detail: '5 200 ₽ при цели 4 000 ₽',
    actionLabel: 'К фудкосту',
    actionKind: 'link',
    link: '/foodcost',
  },
};

export const RevenuePace: Story = {
  args: {
    severity: 'warn',
    title: 'Темп выручки под риском',
    detail: 'Факт отстаёт от ожиданий на сегодня',
    actionLabel: 'К дашборду',
    actionKind: 'link',
    link: '/dashboard',
  },
};

export const MonthPlan: Story = {
  args: {
    severity: 'warn',
    title: 'Нет плана на месяц',
    detail: 'Задайте план выручки',
    actionLabel: 'К целям',
    actionKind: 'link',
    link: '/targets',
  },
};

export const AttentionLoadError: Story = {
  args: {
    severity: 'warn',
    title: 'Не удалось загрузить бриф',
    detail: 'Повторите попытку',
    actionLabel: 'Повторить',
    actionKind: 'none',
    link: null,
  },
};

export const FreshnessLoadError: Story = {
  args: {
    severity: 'warn',
    title: 'Статус данных неизвестен',
    detail: 'Не удалось проверить актуальность',
    actionLabel: 'Повторить',
    actionKind: 'none',
    link: null,
  },
};
