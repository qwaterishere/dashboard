import type { Meta, StoryObj } from '@storybook/angular';

import type { PeriodGranularity } from '../../../../shared/models/common.model';
import type { ChartPeriodSelection } from '../../../../core/services/period.service';
import type { DataBounds } from '../../../../shared/models/dashboard-api.model';
import { MOLECULE_DEMO_WIDE } from '../../../../ui/storybook/demo-frame';
import { ChartPeriodPickerComponent } from './chart-period-picker.component';

interface ChartPeriodPickerStoryArgs {
  label: string;
  granularity: PeriodGranularity;
  hasSelection: boolean;
}

const MOCK_BOUNDS: DataBounds = {
  earliest: '2025-03-10',
  latest: '2026-08-22',
};

const MOCK_ACTIVE_PERIOD = {
  year: 2026,
  month: 6,
  dayFrom: 1,
  dayTo: 30,
};

const MOCK_SELECTION: ChartPeriodSelection = {
  year: 2026,
  month: 6,
  weekStartDate: '2026-03-09',
  weekEndDate: '2026-03-15',
};

const meta: Meta<ChartPeriodPickerStoryArgs> = {
  title: 'Molecules/ChartPeriodPicker',
  component: ChartPeriodPickerComponent,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Нажмите pill, чтобы открыть панель выбора периода.',
      },
    },
  },
  argTypes: {
    label: { control: 'text' },
    granularity: { control: 'select', options: ['month', 'week', 'year'] },
    hasSelection: { control: 'boolean', description: 'Показать кнопку «Сбросить»' },
  },
};

export default meta;
type Story = StoryObj<ChartPeriodPickerStoryArgs>;

function renderPicker(args: ChartPeriodPickerStoryArgs) {
  return {
    props: {
      ...args,
      bounds: MOCK_BOUNDS,
      activePeriod: MOCK_ACTIVE_PERIOD,
      selection: args.hasSelection
        ? args.granularity === 'week'
          ? MOCK_SELECTION
          : { year: 2026, month: 5 }
        : null,
      panelOpen: false,
      onApplied: (value: ChartPeriodSelection) => {
        console.log('applied', value);
      },
      onReset: () => {
        console.log('reset');
      },
      onPanelOpenChange(open: boolean, props: { panelOpen: boolean }) {
        props.panelOpen = open;
      },
    },
    template: `
      <div style="${MOLECULE_DEMO_WIDE}">
        <app-chart-period-picker
          [label]="label"
          [granularity]="granularity"
          [bounds]="bounds"
          [activePeriod]="activePeriod"
          [selection]="selection"
          [panelOpen]="panelOpen"
          (panelOpenChange)="onPanelOpenChange($event, this)"
          (applied)="onApplied($event)"
          (resetSelection)="onReset()"
        />
      </div>
    `,
  };
}

export const Month: Story = {
  args: {
    label: '1–30 июня 2026',
    granularity: 'month',
    hasSelection: false,
  },
  render: renderPicker,
};

export const Week: Story = {
  args: {
    label: '9–15 июня 2026',
    granularity: 'week',
    hasSelection: true,
  },
  render: renderPicker,
};

export const Year: Story = {
  args: {
    label: '2026',
    granularity: 'year',
    hasSelection: true,
  },
  render: renderPicker,
};
