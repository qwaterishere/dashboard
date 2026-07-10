import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_PANEL, ATOM_PROGRESS_WIDTH } from '../../storybook/demo-frame';
import { ProgressTrackComponent } from './progress-track.component';
import { ProgressFillComponent } from '../progress-fill/progress-fill.component';
import { MarkLineComponent } from '../mark-line/mark-line.component';

type TrackVariant = 'goal' | 'bar' | 'fc' | 'rev';

interface ProgressTrackStoryArgs {
  variant: TrackVariant;
  fillWidth: number;
  showGoalMark: boolean;
  goalPosition: number;
}

const meta: Meta<ProgressTrackStoryArgs> = {
  title: 'Atoms/ProgressTrack',
  component: ProgressTrackComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    variant: { control: 'select', options: ['bar', 'goal', 'fc', 'rev'] },
    fillWidth: { control: { type: 'range', min: 0, max: 100, step: 1 } },
    showGoalMark: { control: 'boolean' },
    goalPosition: { control: { type: 'range', min: 0, max: 100, step: 0.1 } },
  },
};

export default meta;
type Story = StoryObj<ProgressTrackStoryArgs>;

export const Default: Story = {
  args: {
    variant: 'goal',
    fillWidth: 78,
    showGoalMark: true,
    goalPosition: 100,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <app-progress-track [variant]="variant" style="${ATOM_PROGRESS_WIDTH}">
          <app-progress-fill
            [width]="fillWidth"
            [variant]="variant === 'goal' ? 'good' : variant === 'fc' ? 'mid' : 'default'"
          />
          @if (showGoalMark) {
            <app-mark-line variant="goal" [position]="goalPosition" />
          }
        </app-progress-track>
      </div>
    `,
    moduleMetadata: { imports: [ProgressFillComponent, MarkLineComponent] },
  }),
};
