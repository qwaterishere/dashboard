import type { Meta, StoryObj } from '@storybook/angular';

import { DividerComponent } from './divider.component';

const panel =
  'display:grid;gap:24px;width:min(360px,calc(100vw - 48px));padding:20px 24px;box-sizing:border-box;background:var(--side);border:1px solid var(--line);border-radius:12px;';

const caption = 'margin:0 0 14px;font-size:0.75rem;color:var(--mut2);';

const insetSection = 'padding-inline:20px;';

const meta: Meta = {
  title: 'Atoms/Divider',
  component: DividerComponent,
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => ({
    template: `
      <div style="${panel}">
        <section>
          <p style="${caption}">На всю ширину блока</p>
          <app-divider />
        </section>
        <section style="${insetSection}">
          <p style="${caption}">Короче за счёт padding родителя</p>
          <app-divider />
        </section>
      </div>
    `,
  }),
};
