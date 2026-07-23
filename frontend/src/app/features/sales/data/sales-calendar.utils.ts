import { MONTHS_SHORT } from '../../../shared/constants/month-labels.constants';
import { daysInMonth, toIsoDateString } from '../../../shared/utils/chart-period.utils';

export const SALES_WEEKDAY_LABELS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const;

export interface SalesCalendarCell {
  key: string;
  /** ISO yyyy-mm-dd; null — пустая ячейка сетки. */
  iso: string | null;
  label: string;
  disabled: boolean;
  isStart: boolean;
  isEnd: boolean;
  inRange: boolean;
}

export function parseSalesIsoDate(
  value: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function formatSalesCalendarMonthTitle(year: number, month: number): string {
  const name = MONTHS_SHORT[month - 1] ?? '';
  return `${name} ${year}`;
}

/** Сетка месяца (пн→вс), с подсветкой диапазона. */
export function buildSalesCalendarCells(
  year: number,
  month: number,
  dateFrom: string | null,
  dateTo: string | null,
  maxIso: string | null = null,
): SalesCalendarCell[] {
  const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7; // 0=пн
  const totalDays = daysInMonth(year, month);
  const cells: SalesCalendarCell[] = [];

  const from = dateFrom && parseSalesIsoDate(dateFrom) ? dateFrom : null;
  const to = dateTo && parseSalesIsoDate(dateTo) ? dateTo : null;
  const rangeStart = from && to ? (from <= to ? from : to) : from;
  const rangeEnd = from && to ? (from <= to ? to : from) : from;

  for (let i = 0; i < firstWeekday; i++) {
    cells.push({
      key: `pad-${i}`,
      iso: null,
      label: '',
      disabled: true,
      isStart: false,
      isEnd: false,
      inRange: false,
    });
  }

  for (let day = 1; day <= totalDays; day++) {
    const iso = toIsoDateString(year, month, day);
    const disabled = !!maxIso && iso > maxIso;
    const isStart = !!rangeStart && iso === rangeStart;
    const isEnd = !!rangeEnd && iso === rangeEnd;
    const inRange =
      !!rangeStart &&
      !!rangeEnd &&
      iso > rangeStart &&
      iso < rangeEnd;

    cells.push({
      key: iso,
      iso,
      label: String(day),
      disabled,
      isStart,
      isEnd,
      inRange,
    });
  }

  while (cells.length % 7 !== 0) {
    const i = cells.length;
    cells.push({
      key: `pad-end-${i}`,
      iso: null,
      label: '',
      disabled: true,
      isStart: false,
      isEnd: false,
      inRange: false,
    });
  }

  return cells;
}

export function shiftCalendarMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}
