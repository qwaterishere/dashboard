import type { Meta, StoryObj } from '@storybook/angular';

import { ATOM_DEMO_PANEL } from '../../storybook/demo-frame';
import { GoalTrackComponent } from './goal-track.component';

interface GoalTrackStoryArgs {
  label: string;
  headline: string;
  trackPct: number;
  risk: boolean;
}

const meta: Meta<GoalTrackStoryArgs> = {
  title: 'Molecules/GoalTrack',
  component: GoalTrackComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    label: { control: 'text' },
    headline: { control: 'text' },
    trackPct: { control: { type: 'range', min: 0, max: 150, step: 1 } },
    risk: { control: 'boolean', description: 'Красный headline + fill variant risk' },
  },
};

export default meta;
type Story = StoryObj<GoalTrackStoryArgs>;

export const Default: Story = {
  args: {
    label: 'Прогноз на конец месяца',
    headline: '9,2 млн ₽ · 94% плана',
    trackPct: 94,
    risk: false,
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="${ATOM_DEMO_PANEL}">
        <app-goal-track
          [label]="label"
          [headline]="headline"
          [trackPct]="trackPct"
          [risk]="risk"
        />
      </div>
    `,
  }),
};
