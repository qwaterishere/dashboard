import type { ChartDisplayMode, PeriodGranularity } from '../models/common.model';
import type { SegmentOption } from '../models/segment-option.model';

/** Порядок UI: от детального к агрегированному. */
export const CHART_DISPLAY_OPTIONS: SegmentOption<ChartDisplayMode>[] = [
  { value: 'day', label: 'Дни' },
  { value: 'week', label: 'Недели' },
  { value: 'month', label: 'Месяцы' },
  { value: 'quarter', label: 'Кварталы' },
];

export function availableChartDisplayModes(timeframe: PeriodGranularity): ChartDisplayMode[] {
  switch (timeframe) {
    case 'week':
      return ['day'];
    case 'month':
      return ['day', 'week'];
    case 'year':
      return ['month', 'quarter'];
  }
}

export function chartDisplayOptionsForTimeframe(
  timeframe: PeriodGranularity,
): SegmentOption<ChartDisplayMode>[] {
  const allowed = new Set(availableChartDisplayModes(timeframe));
  return CHART_DISPLAY_OPTIONS.filter((option) => allowed.has(option.value));
}

export function defaultChartDisplayMode(timeframe: PeriodGranularity): ChartDisplayMode {
  switch (timeframe) {
    case 'week':
    case 'month':
      return 'day';
    case 'year':
      return 'month';
  }
}
