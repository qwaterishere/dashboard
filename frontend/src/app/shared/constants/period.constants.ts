import type { PeriodGranularity, PeriodInfo } from '../models/common.model';
import type { SegmentOption } from '../../ui/molecules/segment-control/segment-control.model';

export const PERIOD_GRANULARITY_OPTIONS: SegmentOption<PeriodGranularity>[] = [
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
];

/** Статичные данные периода в шапке (общие для всех разделов). */
export const APP_PERIOD: PeriodInfo = {
  label: 'Июнь 2026',
  note: '1–11 · закрытые дни',
  compareWith: 'июнем 2025',
};
