import type { Meta, StoryObj } from '@storybook/angular';

import type { CategoryKey } from '../../../shared/models';
import { ATOM_DEMO_PANEL, ATOM_PROGRESS_WIDTH } from '../../storybook/demo-frame';
import { ProgressFillComponent } from './progress-fill.component';
import { ProgressTrackComponent } from '../progress-track/progress-track.component';

type FillVariant = 'default' | 'good' | 'mid' | 'bad' | 'risk';
type TrackVariant = 'goal' | 'bar' | 'fc' | 'rev';
type ColorMode = 'variant' | 'category';

interface ProgressFillStoryArgs {
  width: number;
  trackVariant: TrackVariant;
  colorMode: ColorMode;
  fillVariant: FillVariant;
  category: CategoryKey;
}

const meta: Meta<ProgressFillStoryArgs> = {
  title: 'Atoms/ProgressFill',
  component: ProgressFillComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    width: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    trackVariant: { control: 'select', options: ['bar', 'goal', 'fc', 'rev'] },
    colorMode: { control: 'inline-radio', options: ['variant', 'category'] },
    fillVariant: { control: 'select', options: ['default', 'good', 'mid', 'bad', 'risk'] },
    category: { control: 'select', options: ['k', 'b', 'w', 'o'] satisfies CategoryKey[] },
  },
};

export default meta;
type Story = StoryObj<ProgressFillStoryArgs>;

export const Default: Story = {
  args: {
    width: 72,
    trackVariant: 'bar',
    colorMode: 'variant',
    fillVariant: 'default',
    category: 'k',
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <app-progress-track [variant]="trackVariant" style="${ATOM_PROGRESS_WIDTH}">
          @if (colorMode === 'category') {
            <app-progress-fill [width]="width" [category]="category" />
          } @else {
            <app-progress-fill [width]="width" [variant]="fillVariant" />
          }
        </app-progress-track>
      </div>
    `,
    moduleMetadata: { imports: [ProgressTrackComponent] },
  }),
};
