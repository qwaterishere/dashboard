import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { DotComponent, type DotVariant } from './dot.component';
import { CAT_NAME } from '../../../shared/constants/category.constants';

interface DotStoryArgs {
  variant: DotVariant;
}

const VARIANT_OPTIONS: DotVariant[] = ['default', 'k', 'b', 'w', 'o'];

const variantLabel: Record<DotVariant, string> = {
  default: 'По умолчанию (кухня)',
  k: CAT_NAME.k,
  b: CAT_NAME.b,
  w: CAT_NAME.w,
  o: CAT_NAME.o,
};

const meta: Meta<DotStoryArgs> = {
  title: 'Atoms/Dot',
  component: DotComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: { control: 'select', options: VARIANT_OPTIONS },
  },
};

export default meta;
type Story = StoryObj<DotStoryArgs>;

export const Default: Story = {
  args: { variant: 'default' },
  render: (args) => ({
    props: { ...args, variantLabel },
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <div style="display:flex;align-items:center;gap:10px;">
          <app-dot [variant]="variant" />
          <span style="font-size:0.8rem;color:var(--mut);">{{ variantLabel[variant] }}</span>
        </div>
      </div>
    `,
  }),
};
