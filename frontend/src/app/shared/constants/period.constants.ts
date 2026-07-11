import type { PeriodGranularity } from '../models/common.model';
import type { SegmentOption } from '../models/segment-option.model';

export const PERIOD_GRANULARITY_OPTIONS: SegmentOption<PeriodGranularity>[] = [
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
];
