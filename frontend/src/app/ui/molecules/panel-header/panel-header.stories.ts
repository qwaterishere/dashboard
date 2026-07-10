import type { Meta, StoryObj } from '@storybook/angular';

import { MOLECULE_DEMO_WIDE } from '../../storybook/demo-frame';
import { PanelHeaderComponent } from './panel-header.component';
import { SegmentControlComponent } from '../segment-control/segment-control.component';

interface PanelHeaderStoryArgs {
  title: string;
  showSegment: boolean;
  segmentValue: string;
}

const SEGMENT_OPTIONS = [
  { value: 'donut', label: 'Кольцо' },
  { value: 'bars', label: 'Столбцы' },
];

const meta: Meta<PanelHeaderStoryArgs> = {
  title: 'Molecules/PanelHeader',
  component: PanelHeaderComponent,
  parameters: { layout: 'centered' },
  argTypes: {
    title: { control: 'text' },
    showSegment: { control: 'boolean', description: 'Показать segment-control в слоте' },
    segmentValue: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<PanelHeaderStoryArgs>;

export const Default: Story = {
  args: {
    title: 'Структура продаж',
    showSegment: true,
    segmentValue: 'donut',
  },
  render: (args) => ({
    props: { ...args, segmentOptions: SEGMENT_OPTIONS },
    moduleMetadata: { imports: [SegmentControlComponent] },
    template: `
      <div style="${MOLECULE_DEMO_WIDE}">
        <app-panel-header [title]="title">
          @if (showSegment) {
            <app-segment-control
              [options]="segmentOptions"
              [(value)]="segmentValue"
            />
          }
        </app-panel-header>
      </div>
    `,
  }),
};
