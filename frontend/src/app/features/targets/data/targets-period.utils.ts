import { MONTHS_SHORT } from '../../../shared/constants/month-labels.constants';
import type { TargetsMonthSelection } from './targets-period.model';

export const MONTHS_NOMINATIVE = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const;

export function formatTargetsMonthLabel(year: number, month: number): string {
  const name = MONTHS_NOMINATIVE[month - 1] ?? String(month);
  return `${name} ${year}`;
}

export function formatTargetsMonthShort(month: number): string {
  return MONTHS_SHORT[month - 1] ?? String(month);
}

export function parseTargetsAnchorIso(anchorIso: string): TargetsMonthSelection | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(anchorIso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

export function currentCalendarMonth(): TargetsMonthSelection {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Диапазон лет для навигации в пикере (±span от якоря). */
export function targetsYearBounds(
  anchorYear: number,
  span = 2,
): { minYear: number; maxYear: number } {
  return { minYear: anchorYear - span, maxYear: anchorYear + span };
}
